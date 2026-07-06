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
  const autoEnabled = {
    sam:    samRow    ? samRow.value    === '1' : false,
    grants: grantsRow ? grantsRow.value === '1' : false
  };

  let autoLogs = [];
  try {
    [autoLogs] = await db.query(
      "SELECT * FROM automation_log ORDER BY ran_at DESC LIMIT 10"
    );
  } catch (_) {}

  res.render('settings/index', { title: 'Settings', settings, naics, keywords, sources, autoEnabled, autoLogs });
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
  await db.query("UPDATE user_settings SET value=? WHERE name='auto_sam_enabled'",    [sam]);
  await db.query("UPDATE user_settings SET value=? WHERE name='auto_grants_enabled'", [grants]);
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

module.exports = router;
