const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { q, type, state } = req.query;
  let where = ['is_active = 1'];
  const params = [];
  if (q) { where.push('name LIKE ?'); params.push(`%${q}%`); }
  if (type) { where.push('institution_type = ?'); params.push(type); }
  if (state) { where.push('state = ?'); params.push(state); }

  const [institutions] = await db.query(
    `SELECT * FROM institutions WHERE ${where.join(' AND ')} ORDER BY name`,
    params
  );
  res.render('institutions/index', { title: 'Institutions', institutions, filters: { q, type, state } });
});

router.get('/new', (req, res) => {
  res.render('institutions/form', { title: 'Add Institution', institution: null });
});

router.post('/', async (req, res) => {
  const { name, institution_type, city, state, region, website, notes } = req.body;
  const [r] = await db.query(`
    INSERT INTO institutions (name, institution_type, city, state, region, website, notes)
    VALUES (?,?,?,?,?,?,?)
  `, [name, institution_type || null, city || null, state || null,
      region || null, website || null, notes || null]);
  req.flash('success', 'Institution added.');
  res.redirect(`/institutions/${r.insertId}`);
});

router.get('/:id', async (req, res) => {
  const [[institution]] = await db.query('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
  if (!institution) { req.flash('error', 'Not found.'); return res.redirect('/institutions'); }

  const [contacts] = await db.query(
    'SELECT * FROM contacts WHERE institution_id = ? AND is_active=1 ORDER BY last_name',
    [req.params.id]
  );
  const [awards] = await db.query(
    'SELECT * FROM award_history WHERE institution_id = ? ORDER BY period_start DESC',
    [req.params.id]
  );

  res.render('institutions/detail', { title: institution.name, institution, contacts, awards });
});

router.get('/:id/edit', async (req, res) => {
  const [[institution]] = await db.query('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
  if (!institution) { req.flash('error', 'Not found.'); return res.redirect('/institutions'); }
  res.render('institutions/form', { title: 'Edit Institution', institution });
});

router.post('/:id/edit', async (req, res) => {
  const { name, institution_type, city, state, region, website, notes } = req.body;
  await db.query(`
    UPDATE institutions SET name=?, institution_type=?, city=?, state=?, region=?, website=?, notes=?
    WHERE id=?
  `, [name, institution_type || null, city || null, state || null,
      region || null, website || null, notes || null, req.params.id]);
  req.flash('success', 'Institution updated.');
  res.redirect(`/institutions/${req.params.id}`);
});

module.exports = router;
