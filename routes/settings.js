const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const [settings] = await db.query('SELECT * FROM user_settings ORDER BY setting_type, name');
  const [naics] = await db.query('SELECT * FROM naics_codes ORDER BY is_primary DESC, code');
  const [keywords] = await db.query('SELECT * FROM keywords ORDER BY priority, keyword');
  const [sources] = await db.query('SELECT * FROM data_sources ORDER BY source_type, name');

  const [[samRow]]    = await db.query("SELECT value FROM user_settings WHERE name='auto_sam_enabled'");
  const [[grantsRow]] = await db.query("SELECT value FROM user_settings WHERE name='auto_grants_enabled'");
  const [[digestRow]] = await db.query("SELECT value FROM user_settings WHERE name='auto_digest_enabled'");
  const [[claudeRow]] = await db.query("SELECT value FROM user_settings WHERE name='claude_api_key'");

  const autoEnabled = {
    sam:    samRow    ? samRow.value    === '1' : false,
    grants: grantsRow ? grantsRow.value === '1' : false,
    digest: digestRow ? digestRow.value === '1' : false
  };
  const claudeApiKey = claudeRow ? claudeRow.value : null;

  let autoLogs = [];
  try {
    [autoLogs] = await db.query(
      "SELECT * FROM automation_log ORDER BY ran_at DESC LIMIT 10"
    );
  } catch (_) {}

  res.render('settings/index', { title: 'Settings', settings, naics, keywords, sources, autoEnabled, autoLogs, claudeApiKey });
});

router.post('/general', async (req, res) => {
  for (const [key, val] of Object.entries(req.body)) {
    await db.query('UPDATE user_settings SET value = ? WHERE name = ?', [val || null, key]);
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

// CSV import: file upload or paste
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

async function processCSV(csvText, req, res) {
  const { parse } = require('csv-parse/sync');
  let records;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    req.flash('error', 'Could not parse CSV: ' + err.message);
    return res.redirect('/settings#import');
  }

  if (!records.length) {
    req.flash('error', 'CSV contained no data rows.');
    return res.redirect('/settings#import');
  }

  let added = 0, skipped = 0, errors = 0;
  for (const row of records) {
    const name = (row.name || row.Name || '').trim();
    if (!name) { skipped++; continue; }

    const institution_type    = (row.institution_type    || row['Institution Type']    || 'Museum').trim();
    const relationship_status = (row.relationship_status || row['Relationship Status'] || 'Target').trim();
    const city    = (row.city    || row.City    || '').trim() || null;
    const state   = (row.state   || row.State   || '').trim() || null;
    const website = (row.website || row.Website || '').trim() || null;
    const notes   = (row.notes   || row.Notes   || '').trim() || null;

    try {
      const [existing] = await db.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [name]);
      if (existing.length > 0) { skipped++; continue; }
      await db.query(`
        INSERT INTO institutions (name, institution_type, relationship_status, city, state, website, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [name, institution_type, relationship_status, city, state, website, notes]);
      added++;
    } catch (_) {
      errors++;
    }
  }

  const msg = `CSV import complete: ${added} added, ${skipped} skipped (already exist or blank)${errors ? ', ' + errors + ' errors' : ''}.`;
  req.flash('success', msg);
  res.redirect('/institutions');
}

router.post('/import-institutions-csv', upload.single('csv_file'), async (req, res) => {
  let csvText = '';
  if (req.file && req.file.buffer.length > 0) {
    csvText = req.file.buffer.toString('utf8').trim();
  } else {
    csvText = (req.body.csv_data || '').trim();
  }
  if (!csvText) {
    req.flash('error', 'No CSV data provided — upload a file or paste CSV text.');
    return res.redirect('/settings#import');
  }
  return processCSV(csvText, req, res);
});

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
