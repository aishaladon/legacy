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

  res.render('settings/index', { title: 'Settings', settings, naics, keywords, sources });
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
