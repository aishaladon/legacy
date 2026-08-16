const express = require('express');
const router = express.Router();
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const { rescoreAll } = require('../services/alignmentScorer');
const { getClaudeApiKey } = require('../utils/claudeApiKey');
const { extractResponseText } = require('../utils/claudeResponseText');
const { extractTextFromFile } = require('../utils/fileText');
const { generateSqlBackup, buildZipBuffer, runBackup } = require('../services/backupService');

router.use(requireLogin);

// Self-provisioning so the logo survives redeploys immediately, without
// needing /setup re-run first (same pattern as automation_log elsewhere).
db.query(`
  CREATE TABLE IF NOT EXISTS company_assets (
    name       VARCHAR(50) PRIMARY KEY,
    mime_type  VARCHAR(100) NOT NULL,
    data       LONGBLOB NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`).catch(() => {});

const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function getCapabilityStatement() {
  const [[guide]] = await db.query(
    "SELECT id, content FROM bid_writing_guides WHERE is_template = 1 ORDER BY sort_order LIMIT 1"
  );
  return guide || null;
}

async function saveCapabilityStatement(content) {
  const existing = await getCapabilityStatement();
  if (existing) {
    await db.query('UPDATE bid_writing_guides SET content = ? WHERE id = ?', [content, existing.id]);
  } else {
    await db.query(`
      INSERT INTO bid_writing_guides (title, opportunity_type, content, is_template, sort_order)
      VALUES ('Capability Statement', 'Other', ?, 1, 0)
    `, [content]);
  }
}

const PROFILE_FIELD_META = {
  company_business_name:     'Business name',
  company_owner_name:        "Owner's name",
  company_years_in_business: 'Years in business',
  company_website:           'Company website — included in outreach email drafts',
  company_cage:               'CAGE code — used in bid prep',
  company_uei:                'UEI — used in SAM.gov queries and bid prep',
  company_certifications:     'Active certifications'
};
const PROFILE_FIELD_NAMES = Object.keys(PROFILE_FIELD_META);

router.get('/', async (req, res) => {
  // Both queries key off PROFILE_FIELD_NAMES rather than trusting
  // setting_type='Profile' in the DB — on an install where these fields
  // predate the Company Profile card, they may still be stored as
  // setting_type='Text', which would make them vanish from the Profile
  // card (queried by type) while lingering, duplicated, in General
  // Settings. Selecting/excluding by name is correct regardless of
  // whatever type is currently on the row.
  const profilePlaceholders = PROFILE_FIELD_NAMES.map(() => '?').join(',');
  const [settings] = await db.query(
    `SELECT * FROM user_settings WHERE setting_type NOT IN ('Profile','Internal') AND name NOT IN (${profilePlaceholders}) ORDER BY setting_type, name`,
    PROFILE_FIELD_NAMES
  );
  const [profileSettings] = await db.query(
    `SELECT * FROM user_settings WHERE name IN (${profilePlaceholders}) ORDER BY name`,
    PROFILE_FIELD_NAMES
  );
  const [naics] = await db.query('SELECT * FROM naics_codes ORDER BY is_primary DESC, code');
  const [keywords] = await db.query('SELECT * FROM keywords ORDER BY priority, keyword');
  const [sources] = await db.query('SELECT * FROM data_sources ORDER BY source_type, name');

  const [[samRow]]    = await db.query("SELECT value FROM user_settings WHERE name='auto_sam_enabled'");
  const [[grantsRow]] = await db.query("SELECT value FROM user_settings WHERE name='auto_grants_enabled'");
  const [[digestRow]] = await db.query("SELECT value FROM user_settings WHERE name='auto_digest_enabled'");
  const [[claudeRow]] = await db.query("SELECT value FROM user_settings WHERE name='claude_api_key'");
  const [[logoRow]]   = await db.query("SELECT value FROM user_settings WHERE name='company_logo_path'");

  const autoEnabled = {
    sam:    samRow    ? samRow.value    === '1' : false,
    grants: grantsRow ? grantsRow.value === '1' : false,
    digest: digestRow ? digestRow.value === '1' : false
  };
  const claudeApiKey = claudeRow ? claudeRow.value : null;
  const logoPath = logoRow ? logoRow.value : null;
  const capabilityStatement = await getCapabilityStatement();

  let autoLogs = [];
  try {
    [autoLogs] = await db.query(
      "SELECT * FROM automation_log ORDER BY ran_at DESC LIMIT 10"
    );
  } catch (_) {}

  res.render('settings/index', {
    title: 'Settings', settings, profileSettings, naics, keywords, sources, autoEnabled, autoLogs, claudeApiKey,
    logoPath, capabilityStatement
  });
});

// Upsert, not a plain UPDATE — these setting rows may not exist yet on an
// install that hasn't re-run /setup since this field was added, and a bare
// UPDATE against a missing row silently affects zero rows (no error, but
// nothing gets saved either) — confirmed live with the logo path setting.
// Also re-writes setting_type/description on conflict, not just value, so a
// row stuck with a stale type (e.g. company_cage saved back when it was
// still setting_type='Text', before the Profile card existed) heals itself
// the next time it's saved instead of staying invisible to the Profile card.
async function upsertSetting(name, value, settingType, description) {
  await db.query(
    'INSERT INTO user_settings (name, value, setting_type, description) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE value = VALUES(value), setting_type = VALUES(setting_type), description = VALUES(description)',
    [name, value, settingType, description]
  );
}

router.post('/company-profile', async (req, res) => {
  for (const [key, val] of Object.entries(req.body)) {
    if (!PROFILE_FIELD_META[key]) continue;
    await upsertSetting(key, val || null, 'Profile', PROFILE_FIELD_META[key]);
  }
  req.flash('success', 'Company profile saved.');
  res.redirect('/settings#profile');
});

const LOGO_MIME_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' };

router.post('/logo', imageUpload.single('logo'), async (req, res) => {
  if (!req.file) { req.flash('error', 'No file selected.'); return res.redirect('/settings#profile'); }

  const ext = (req.file.originalname.split('.').pop() || '').toLowerCase();
  if (!LOGO_MIME_TYPES[ext]) {
    req.flash('error', 'Unsupported image type — use PNG, JPG, SVG, or WebP.');
    return res.redirect('/settings#profile');
  }

  // Stored as a DB blob, not a file on local disk — Hostinger's "Upload new
  // files" redeploy re-extracts a fresh ZIP over the app directory, which
  // wipes anything written to public/uploads/ at runtime (it was never part
  // of the deployed ZIP to begin with). The database is the only storage
  // here that actually survives a redeploy.
  await db.query(
    'INSERT INTO company_assets (name, mime_type, data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), data = VALUES(data), updated_at = NOW()',
    ['logo', LOGO_MIME_TYPES[ext], req.file.buffer]
  );

  await upsertSetting('company_logo_path', `/settings/logo-image?v=${Date.now()}`, 'Internal', 'Company logo — served from the database, not a file path');
  req.flash('success', 'Logo uploaded.');
  res.redirect('/settings#profile');
});

router.get('/logo-image', async (req, res) => {
  const [[asset]] = await db.query('SELECT mime_type, data FROM company_assets WHERE name = ?', ['logo']);
  if (!asset) return res.status(404).end();
  res.setHeader('Content-Type', asset.mime_type);
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(asset.data);
});

router.post('/capability-statement', async (req, res) => {
  await saveCapabilityStatement(req.body.content || '');
  req.flash('success', 'Capability statement saved.');
  res.redirect('/settings#profile');
});

router.post('/capability-statement-upload', docUpload.single('file'), async (req, res) => {
  if (!req.file) { req.flash('error', 'No file selected.'); return res.redirect('/settings#profile'); }

  let text;
  try {
    text = await extractTextFromFile(req.file, 20000);
  } catch (err) {
    req.flash('error', err.message);
    return res.redirect('/settings#profile');
  }

  await saveCapabilityStatement(text);

  const apiKey = await getClaudeApiKey();
  if (!apiKey) {
    req.flash('success', 'Capability statement uploaded and saved. Add a Claude API key in Settings → API Keys, then re-upload to get keyword/NAICS suggestions.');
    return res.redirect('/settings#profile');
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Read this capability statement and suggest search keywords and NAICS codes for tracking relevant government contract/grant opportunities. Base suggestions only on what's actually described — don't invent unrelated ones.

CAPABILITY STATEMENT:
${text.slice(0, 12000)}

Respond ONLY with valid JSON (no markdown), up to 15 keywords and up to 8 NAICS codes:
{"keywords": [{"keyword": "...", "priority": "High"}], "naics_codes": [{"code": "6-digit code", "description": "..."}]}`
      }]
    });

    const raw = extractResponseText(response).trim();
    const suggestions = JSON.parse(raw);
    req.session.capabilitySuggestions = suggestions;
    return res.redirect('/settings/capability-review');
  } catch (err) {
    console.error('Capability statement extraction error:', err.message);
    req.flash('success', 'Capability statement uploaded and saved. Keyword/NAICS suggestion failed — you can add them manually below.');
    return res.redirect('/settings#profile');
  }
});

router.get('/capability-review', (req, res) => {
  const suggestions = req.session.capabilitySuggestions;
  if (!suggestions) {
    req.flash('error', 'No pending suggestions — upload a capability statement first.');
    return res.redirect('/settings#profile');
  }
  res.render('settings/capability-review', { title: 'Review Suggested Keywords & NAICS', suggestions });
});

router.post('/capability-review/apply', async (req, res) => {
  const suggestions = req.session.capabilitySuggestions;
  if (!suggestions) {
    req.flash('error', 'Nothing to apply — the suggestions expired. Try uploading again.');
    return res.redirect('/settings#profile');
  }

  const selectedKeywords = [].concat(req.body.keywords || []);
  const selectedNaics = [].concat(req.body.naics || []);
  let addedKw = 0, addedNaics = 0;

  for (const idx of selectedKeywords) {
    const kw = (suggestions.keywords || [])[idx];
    if (!kw || !kw.keyword) continue;
    const [existing] = await db.query('SELECT id FROM keywords WHERE keyword = ? LIMIT 1', [kw.keyword]);
    if (existing.length) continue;
    const priority = ['High', 'Medium', 'Low'].includes(kw.priority) ? kw.priority : 'Medium';
    await db.query('INSERT INTO keywords (keyword, priority) VALUES (?,?)', [kw.keyword, priority]);
    addedKw++;
  }

  for (const idx of selectedNaics) {
    const n = (suggestions.naics_codes || [])[idx];
    if (!n || !n.code) continue;
    const [existing] = await db.query('SELECT id FROM naics_codes WHERE code = ? LIMIT 1', [n.code]);
    if (existing.length) continue;
    await db.query('INSERT INTO naics_codes (code, description) VALUES (?,?)', [n.code, n.description || '']);
    addedNaics++;
  }

  delete req.session.capabilitySuggestions;
  req.flash('success', `Added ${addedKw} keyword(s) and ${addedNaics} NAICS code(s).`);
  res.redirect('/settings#naics');
});

router.post('/general', async (req, res) => {
  for (const [key, val] of Object.entries(req.body)) {
    await db.query(
      'INSERT INTO user_settings (name, value) VALUES (?,?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [key, val || null]
    );
  }
  req.flash('success', 'Settings saved.');
  res.redirect('/settings');
});

router.post('/keywords/:id/delete', async (req, res) => {
  await db.query('DELETE FROM keywords WHERE id = ?', [req.params.id]);
  req.flash('success', 'Keyword removed.');
  res.redirect('/settings#keywords');
});

router.post('/keywords', async (req, res) => {
  const { keyword, priority } = req.body;
  await db.query(
    'INSERT IGNORE INTO keywords (keyword, priority) VALUES (?,?)',
    [keyword.trim(), priority || 'Medium']
  );
  req.flash('success', 'Keyword added.');
  res.redirect('/settings#keywords');
});

router.post('/naics/:id/toggle', async (req, res) => {
  await db.query('UPDATE naics_codes SET is_primary = NOT is_primary WHERE id = ?', [req.params.id]);
  res.redirect('/settings#naics');
});

router.post('/naics/:id/delete', async (req, res) => {
  await db.query('DELETE FROM naics_codes WHERE id = ?', [req.params.id]);
  req.flash('success', 'NAICS code removed.');
  res.redirect('/settings#naics');
});

router.post('/sources/:id/toggle', async (req, res) => {
  await db.query('UPDATE data_sources SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
  res.redirect('/settings#sources');
});

// Automation toggle
router.post('/automations', async (req, res) => {
  const sam    = req.body.auto_sam_enabled    === '1' ? '1' : '0';
  const grants = req.body.auto_grants_enabled === '1' ? '1' : '0';
  const digest = req.body.auto_digest_enabled === '1' ? '1' : '0';
  await db.query("UPDATE user_settings SET value=? WHERE name='auto_sam_enabled'",    [sam]);
  await db.query("UPDATE user_settings SET value=? WHERE name='auto_grants_enabled'", [grants]);
  await db.query("UPDATE user_settings SET value=? WHERE name='auto_digest_enabled'", [digest]);
  req.flash('success', 'Automation settings saved.');
  res.redirect('/settings#automations');
});

// Manual run — SAM.gov
router.post('/run-sam', async (req, res) => {
  const { runSamDigest } = require('../services/scheduler');
  const apiKey = process.env.SAM_API_KEY;
  if (!apiKey) {
    req.flash('error', 'SAM_API_KEY is not set in your Hostinger environment variables.');
    return res.redirect('/settings#automations');
  }
  // Temporarily force-enable for this one run
  await db.query("UPDATE user_settings SET value='1' WHERE name='auto_sam_enabled'");
  const result = await runSamDigest();
  req.flash('success', result && result.newCount != null
    ? `SAM.gov digest complete — ${result.newCount} new opportunities added.`
    : 'SAM.gov digest ran. Check Opportunities for new items.');
  res.redirect('/settings#automations');
});

// Manual run — Grants.gov
router.post('/run-grants', async (req, res) => {
  const { runGrantsPull } = require('../services/scheduler');
  // Temporarily force-enable for this one run
  await db.query("UPDATE user_settings SET value='1' WHERE name='auto_grants_enabled'");
  const result = await runGrantsPull();
  req.flash('success', result && result.newCount != null
    ? `Grants.gov pull complete — ${result.newCount} new opportunities added.`
    : 'Grants.gov pull ran. Check Opportunities for new items.');
  res.redirect('/settings#automations');
});

// Manual run — Daily Digest
router.post('/run-digest', async (req, res) => {
  const { sendDailyDigest } = require('../services/digestMailer');
  const result = await sendDailyDigest();
  if (result.status === 'success') {
    req.flash('success', `Digest sent — ${result.count} opportunit${result.count === 1 ? 'y' : 'ies'} included. See Digest Log for details.`);
  } else if (result.status === 'skipped') {
    req.flash('error', `Digest not sent: ${result.message}`);
  } else {
    req.flash('error', `Digest send failed: ${result.message}`);
  }
  res.redirect('/settings#automations');
});

// Manual run — Recalculate alignment scores for every opportunity
router.post('/rescore', async (req, res) => {
  const count = await rescoreAll();
  req.flash('success', `Alignment scores recalculated for ${count} opportunit${count === 1 ? 'y' : 'ies'}.`);
  res.redirect('/settings#automations');
});

// Instant backup — streams a zipped .sql dump straight to the browser, no
// SMTP/email required. The reliable option for "I need a backup right now."
router.get('/backup-download', async (req, res) => {
  try {
    const { sql, tableCount, rowCount } = await generateSqlBackup();
    const today = new Date().toISOString().split('T')[0];
    const zipBuffer = await buildZipBuffer(sql, `legacy-govcon-backup-${today}.sql`);

    await db.query(
      'INSERT INTO automation_log (run_type, status, items_found, message) VALUES (?,?,?,?)',
      ['backup', 'success', rowCount, `Downloaded directly — ${tableCount} tables, ${rowCount} rows.`]
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="legacy-govcon-backup-${today}.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    req.flash('error', 'Backup failed: ' + err.message);
    res.redirect('/settings#backup');
  }
});

// Manual run — email a backup now (tests the same path the schedule uses)
router.post('/run-backup', async (req, res) => {
  const result = await runBackup();
  if (result.status === 'success') {
    req.flash('success', result.message);
  } else {
    req.flash('error', `Backup not sent: ${result.message}`);
  }
  res.redirect('/settings#backup');
});

// One-time seed: loads the starter target institution list
router.post('/seed-institutions', async (req, res) => {
  const { institutions } = require('../database/seeds/institutions_data');
  let added = 0, skipped = 0;
  for (const inst of institutions) {
    const [existing] = await db.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [inst.name]);
    if (existing.length > 0) { skipped++; continue; }
    await db.query(`
      INSERT INTO institutions (name, institution_type, relationship_status, city, state, website, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [inst.name, inst.institution_type, inst.relationship_status,
        inst.city || null, inst.state || null, inst.website || null, inst.notes || null]);
    added++;
  }
  req.flash('success', `Starter institutions loaded: ${added} added, ${skipped} already existed.`);
  res.redirect('/institutions');
});

// One-time seed: loads African American museums and cultural institutions
router.post('/seed-aa-museums', async (req, res) => {
  const { africanAmericanMuseums } = require('../database/seeds/african_american_museums');
  let added = 0, skipped = 0;
  for (const inst of africanAmericanMuseums) {
    if (!inst.name || !inst.name.trim()) { skipped++; continue; }
    const [existing] = await db.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [inst.name]);
    if (existing.length > 0) { skipped++; continue; }
    await db.query(`
      INSERT INTO institutions (name, institution_type, relationship_status, city, state, website, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [inst.name, inst.institution_type || 'Museum', inst.relationship_status || 'Target',
        inst.city || null, inst.state || null,
        inst.website || null, inst.notes || null]);
    added++;
  }
  req.flash('success', `African American museums loaded: ${added} added, ${skipped} already existed or skipped.`);
  res.redirect('/institutions');
});

// Institution CSV import moved to the Institutions page itself
// (POST /institutions/import-csv), matching the Contacts/Funders pattern
// of living on the entity's own list page instead of buried in Settings.

router.post('/api-keys', async (req, res) => {
  const { claude_api_key } = req.body;
  if (claude_api_key && claude_api_key.trim()) {
    await db.query(`
      INSERT INTO user_settings (name, value, setting_type)
      VALUES ('claude_api_key', ?, 'API')
      ON DUPLICATE KEY UPDATE value = ?
    `, [claude_api_key.trim(), claude_api_key.trim()]);
    req.flash('success', 'Claude API key saved.');
  } else {
    req.flash('error', 'API key cannot be empty.');
  }
  res.redirect('/settings#api-keys');
});

module.exports = router;
