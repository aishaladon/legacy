const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

// Communications used to require an institution — a contact with no
// institution linked couldn't have anything logged against them. Relaxed
// so a call/email/meeting can be logged straight from a Contact's page
// even when they aren't tied to an org yet.
db.query('ALTER TABLE communications MODIFY COLUMN institution_id INT DEFAULT NULL').catch(() => {});

const COMM_TYPES = ['Email', 'Call', 'Meeting', 'Other'];

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

  const [communications] = await db.query(
    'SELECT * FROM communications WHERE contact_id = ? ORDER BY logged_at DESC, created_at DESC',
    [req.params.id]
  );

  res.render('contacts/detail', {
    title: `${contact.first_name} ${contact.last_name}`, contact, communications, commTypes: COMM_TYPES
  });
});

// Log a communication (email/call/meeting) with this contact. Also tagged
// with their institution_id (if they have one) so it shows up on that
// institution's Communication Log too, not just here.
router.post('/:id/communications', async (req, res) => {
  const [[contact]] = await db.query('SELECT institution_id FROM contacts WHERE id = ?', [req.params.id]);
  if (!contact) { req.flash('error', 'Not found.'); return res.redirect('/contacts'); }

  const { comm_type, direction, subject, notes, logged_at } = req.body;
  await db.query(`
    INSERT INTO communications (institution_id, contact_id, comm_type, direction, subject, notes, logged_at)
    VALUES (?,?,?,?,?,?,?)
  `, [
    contact.institution_id || null,
    req.params.id,
    COMM_TYPES.includes(comm_type) ? comm_type : 'Email',
    direction === 'Inbound' ? 'Inbound' : 'Outbound',
    subject || null,
    notes || null,
    logged_at || new Date().toISOString().split('T')[0]
  ]);
  req.flash('success', 'Communication logged.');
  res.redirect(`/contacts/${req.params.id}#communications`);
});

router.post('/:id/communications/:commId/delete', async (req, res) => {
  await db.query('DELETE FROM communications WHERE id = ? AND contact_id = ?', [req.params.commId, req.params.id]);
  req.flash('success', 'Communication log entry removed.');
  res.redirect(`/contacts/${req.params.id}#communications`);
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

router.post('/:id/delete', async (req, res) => {
  await db.query('UPDATE contacts SET is_active = 0 WHERE id = ?', [req.params.id]);
  req.flash('success', 'Contact deleted.');
  res.redirect('/contacts');
});

// CSV import
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import-csv', upload.single('csv_file'), async (req, res) => {
  const { parse } = require('csv-parse/sync');
  const csvText = (req.file && req.file.buffer.length > 0)
    ? req.file.buffer.toString('utf8').trim()
    : (req.body.csv_data || '').trim();

  if (!csvText) {
    req.flash('error', 'No CSV data provided — upload a file or paste CSV text.');
    return res.redirect('/contacts#import');
  }

  let records;
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  } catch (err) {
    req.flash('error', 'Could not parse CSV: ' + err.message);
    return res.redirect('/contacts#import');
  }

  if (!records.length) {
    req.flash('error', 'CSV contained no data rows.');
    return res.redirect('/contacts#import');
  }

  // Cache institution name → id lookups
  const [instRows] = await db.query('SELECT id, name FROM institutions');
  const instMap = {};
  instRows.forEach(r => { instMap[r.name.trim().toLowerCase()] = r.id; });

  let added = 0, skipped = 0, errors = 0;
  for (const row of records) {
    const first_name = (row.first_name || row['First Name'] || row.first || '').trim();
    const last_name  = (row.last_name  || row['Last Name']  || row.last  || '').trim();
    if (!first_name && !last_name) { skipped++; continue; }

    const title    = (row.title    || row.Title    || '').trim() || null;
    const email    = (row.email    || row.Email    || '').trim() || null;
    const phone    = (row.phone    || row.Phone    || '').trim() || null;
    const linkedin = (row.linkedin || row.LinkedIn || '').trim() || null;
    const notes    = (row.notes    || row.Notes    || '').trim() || null;

    const instName = (row.institution || row.Institution || row.institution_name || row['Institution Name'] || '').trim();
    const institution_id = instName ? (instMap[instName.toLowerCase()] || null) : null;

    try {
      await db.query(`
        INSERT INTO contacts (first_name, last_name, title, email, phone, linkedin, institution_id, notes)
        VALUES (?,?,?,?,?,?,?,?)
      `, [first_name, last_name, title, email, phone, linkedin, institution_id, notes]);
      added++;
    } catch (_) {
      errors++;
    }
  }

  const msg = `Contacts imported: ${added} added, ${skipped} skipped (blank name)${errors ? ', ' + errors + ' errors' : ''}.`;
  req.flash('success', msg);
  res.redirect('/contacts');
});

module.exports = router;
