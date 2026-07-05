const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { award_type, q } = req.query;
  let where = ['1=1'];
  const params = [];
  if (award_type) { where.push('a.award_type = ?'); params.push(award_type); }
  if (q) { where.push('(a.title LIKE ? OR a.agency_funder LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const [awards] = await db.query(`
    SELECT a.*, i.name AS institution_name
    FROM award_history a
    LEFT JOIN institutions i ON a.institution_id = i.id
    WHERE ${where.join(' AND ')}
    ORDER BY a.period_start DESC
    LIMIT 200
  `, params);

  res.render('award_history/index', { title: 'Award History', awards, filters: { award_type, q } });
});

router.get('/new', async (req, res) => {
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('award_history/form', { title: 'Add Award', award: null, institutions });
});

router.post('/', async (req, res) => {
  const {
    title, award_type, agency_funder, institution_id, award_number,
    naics_code, amount, period_start, period_end, set_aside, notes, source_url
  } = req.body;

  await db.query(`
    INSERT INTO award_history
      (title, award_type, agency_funder, institution_id, award_number,
       naics_code, amount, period_start, period_end, set_aside, notes, source_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `, [title, award_type, agency_funder || null, institution_id || null,
      award_number || null, naics_code || null, amount || null,
      period_start || null, period_end || null, set_aside || null,
      notes || null, source_url || null]);

  req.flash('success', 'Award added.');
  res.redirect('/award-history');
});

router.get('/:id/edit', async (req, res) => {
  const [[award]] = await db.query('SELECT * FROM award_history WHERE id = ?', [req.params.id]);
  if (!award) { req.flash('error', 'Not found.'); return res.redirect('/award-history'); }
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('award_history/form', { title: 'Edit Award', award, institutions });
});

router.post('/:id/edit', async (req, res) => {
  const {
    title, award_type, agency_funder, institution_id, award_number,
    naics_code, amount, period_start, period_end, set_aside, notes, source_url
  } = req.body;

  await db.query(`
    UPDATE award_history SET title=?, award_type=?, agency_funder=?, institution_id=?,
      award_number=?, naics_code=?, amount=?, period_start=?, period_end=?,
      set_aside=?, notes=?, source_url=? WHERE id=?
  `, [title, award_type, agency_funder || null, institution_id || null,
      award_number || null, naics_code || null, amount || null,
      period_start || null, period_end || null, set_aside || null,
      notes || null, source_url || null, req.params.id]);

  req.flash('success', 'Award updated.');
  res.redirect('/award-history');
});

module.exports = router;
