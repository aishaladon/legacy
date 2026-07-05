const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { q, institution_id } = req.query;
  let where = ['c.is_active = 1'];
  const params = [];
  if (q) { where.push('(c.first_name LIKE ? OR c.last_name LIKE ? OR c.title LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (institution_id) { where.push('c.institution_id = ?'); params.push(institution_id); }

  const [contacts] = await db.query(`
    SELECT c.*, i.name AS institution_name
    FROM contacts c
    LEFT JOIN institutions i ON c.institution_id = i.id
    WHERE ${where.join(' AND ')}
    ORDER BY c.last_name, c.first_name
  `, params);

  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('contacts/index', { title: 'Contacts', contacts, institutions, filters: { q, institution_id } });
});

router.get('/new', async (req, res) => {
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('contacts/form', { title: 'Add Contact', contact: null, institutions });
});

router.post('/', async (req, res) => {
  const { first_name, last_name, title, email, phone, linkedin, institution_id, notes } = req.body;
  const [r] = await db.query(`
    INSERT INTO contacts (first_name, last_name, title, email, phone, linkedin, institution_id, notes)
    VALUES (?,?,?,?,?,?,?,?)
  `, [first_name, last_name, title || null, email || null, phone || null,
      linkedin || null, institution_id || null, notes || null]);
  req.flash('success', 'Contact added.');
  res.redirect(`/contacts/${r.insertId}`);
});

router.get('/:id', async (req, res) => {
  const [[contact]] = await db.query(`
    SELECT c.*, i.name AS institution_name
    FROM contacts c LEFT JOIN institutions i ON c.institution_id = i.id
    WHERE c.id = ?
  `, [req.params.id]);
  if (!contact) { req.flash('error', 'Not found.'); return res.redirect('/contacts'); }
  res.render('contacts/detail', { title: `${contact.first_name} ${contact.last_name}`, contact });
});

router.get('/:id/edit', async (req, res) => {
  const [[contact]] = await db.query('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
  if (!contact) { req.flash('error', 'Not found.'); return res.redirect('/contacts'); }
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('contacts/form', { title: 'Edit Contact', contact, institutions });
});

router.post('/:id/edit', async (req, res) => {
  const { first_name, last_name, title, email, phone, linkedin, institution_id, notes } = req.body;
  await db.query(`
    UPDATE contacts SET first_name=?, last_name=?, title=?, email=?, phone=?,
      linkedin=?, institution_id=?, notes=? WHERE id=?
  `, [first_name, last_name, title || null, email || null, phone || null,
      linkedin || null, institution_id || null, notes || null, req.params.id]);
  req.flash('success', 'Contact updated.');
  res.redirect(`/contacts/${req.params.id}`);
});

module.exports = router;
