const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { type, q } = req.query;
  let where = ['is_active = 1'];
  const params = [];
  if (type) { where.push('funder_type = ?'); params.push(type); }
  if (q) { where.push('name LIKE ?'); params.push(`%${q}%`); }

  const [funders] = await db.query(
    `SELECT * FROM funders WHERE ${where.join(' AND ')} ORDER BY funder_type, name`,
    params
  );
  res.render('funders/index', { title: 'Funders', funders, filters: { type, q } });
});

router.get('/new', (req, res) => {
  res.render('funders/form', { title: 'Add Funder', funder: null });
});

router.post('/', async (req, res) => {
  const { name, funder_type, website, eligible_institution_types, notes } = req.body;
  const [r] = await db.query(`
    INSERT INTO funders (name, funder_type, website, eligible_institution_types, notes)
    VALUES (?,?,?,?,?)
  `, [name, funder_type, website || null, eligible_institution_types || null, notes || null]);
  req.flash('success', 'Funder added.');
  res.redirect(`/funders/${r.insertId}`);
});

router.get('/:id', async (req, res) => {
  const [[funder]] = await db.query('SELECT * FROM funders WHERE id = ?', [req.params.id]);
  if (!funder) { req.flash('error', 'Not found.'); return res.redirect('/funders'); }
  const [grants] = await db.query(`
    SELECT o.id, o.title, o.due_date, o.status, o.amount_min, o.amount_max
    FROM grant_opportunities go
    JOIN opportunities o ON go.opportunity_id = o.id
    WHERE go.funder_id = ? ORDER BY o.due_date DESC
  `, [req.params.id]);
  res.render('funders/detail', { title: funder.name, funder, grants });
});

router.get('/:id/edit', async (req, res) => {
  const [[funder]] = await db.query('SELECT * FROM funders WHERE id = ?', [req.params.id]);
  if (!funder) { req.flash('error', 'Not found.'); return res.redirect('/funders'); }
  res.render('funders/form', { title: 'Edit Funder', funder });
});

router.post('/:id/edit', async (req, res) => {
  const { name, funder_type, website, eligible_institution_types, notes } = req.body;
  await db.query(`
    UPDATE funders SET name=?, funder_type=?, website=?, eligible_institution_types=?, notes=? WHERE id=?
  `, [name, funder_type, website || null, eligible_institution_types || null, notes || null, req.params.id]);
  req.flash('success', 'Funder updated.');
  res.redirect(`/funders/${req.params.id}`);
});

module.exports = router;
