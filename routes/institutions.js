const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

// Auto-migrate relationship_status column for existing installs
db.query(`
  ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS relationship_status
    ENUM('Target','Prospect','Partner','Client','Vendor') DEFAULT 'Target'
`).catch(() => {});

const STATUSES = ['Target', 'Prospect', 'Partner', 'Client', 'Vendor'];

// Save or update the primary contact for an institution
async function savePrimaryContact(conn, institutionId, body) {
  const { contact_first_name, contact_last_name, contact_title, contact_email, contact_phone } = body;
  if (!contact_first_name && !contact_last_name) return;

  const firstName = (contact_first_name || '').trim();
  const lastName  = (contact_last_name  || '').trim();
  if (!firstName && !lastName) return;

  // Look for an existing contact linked to this institution with the same name or email
  let existing = null;
  if (contact_email) {
    const [byEmail] = await conn.query(
      'SELECT id FROM contacts WHERE institution_id = ? AND email = ? LIMIT 1',
      [institutionId, contact_email]
    );
    if (byEmail.length) existing = byEmail[0];
  }
  if (!existing) {
    const [byName] = await conn.query(
      'SELECT id FROM contacts WHERE institution_id = ? AND first_name = ? AND last_name = ? LIMIT 1',
      [institutionId, firstName, lastName]
    );
    if (byName.length) existing = byName[0];
  }

  if (existing) {
    await conn.query(
      'UPDATE contacts SET first_name=?, last_name=?, title=?, email=?, phone=? WHERE id=?',
      [firstName, lastName, contact_title || null, contact_email || null, contact_phone || null, existing.id]
    );
  } else {
    await conn.query(
      'INSERT INTO contacts (institution_id, first_name, last_name, title, email, phone) VALUES (?,?,?,?,?,?)',
      [institutionId, firstName, lastName, contact_title || null, contact_email || null, contact_phone || null]
    );
  }
}

router.get('/', async (req, res) => {
  const { q, type, state, status } = req.query;
  let where = ['is_active = 1'];
  const params = [];
  if (q)      { where.push('name LIKE ?');              params.push(`%${q}%`); }
  if (type)   { where.push('institution_type = ?');     params.push(type); }
  if (state)  { where.push('state = ?');                params.push(state); }
  if (status) { where.push('relationship_status = ?');  params.push(status); }

  const [institutions] = await db.query(
    `SELECT * FROM institutions WHERE ${where.join(' AND ')} ORDER BY
      FIELD(relationship_status,'Client','Partner','Prospect','Target','Vendor'), name`,
    params
  );
  res.render('institutions/index', {
    title: 'Institutions', institutions,
    filters: { q, type, state, status },
    statuses: STATUSES
  });
});

router.get('/new', (req, res) => {
  res.render('institutions/form', {
    title: 'Add Institution', institution: null,
    primaryContact: null, statuses: STATUSES
  });
});

router.post('/', async (req, res) => {
  const { name, institution_type, relationship_status, city, state, region, website, notes } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(`
      INSERT INTO institutions (name, institution_type, relationship_status, city, state, region, website, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `, [name, institution_type || null, relationship_status || 'Target',
        city || null, state || null, region || null, website || null, notes || null]);
    await savePrimaryContact(conn, r.insertId, req.body);
    await conn.commit();
    req.flash('success', 'Institution added.');
    res.redirect(`/institutions/${r.insertId}`);
  } catch (err) {
    await conn.rollback();
    req.flash('error', 'Could not save: ' + err.message);
    res.redirect('/institutions/new');
  } finally {
    conn.release();
  }
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
  const [opportunities] = await db.query(
    'SELECT id, title, opportunity_type, status, due_date, amount_min, amount_max FROM opportunities WHERE institution_id = ? ORDER BY due_date DESC',
    [req.params.id]
  );
  const [projects] = await db.query(
    'SELECT id, title, project_type, status, start_date, end_date, contract_value, contract_number FROM projects WHERE institution_id = ? ORDER BY start_date DESC',
    [req.params.id]
  );

  res.render('institutions/detail', {
    title: institution.name, institution, contacts, awards, opportunities, projects
  });
});

router.get('/:id/edit', async (req, res) => {
  const [[institution]] = await db.query('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
  if (!institution) { req.flash('error', 'Not found.'); return res.redirect('/institutions'); }
  // Load first contact as primary contact for the form
  const [[primaryContact]] = await db.query(
    'SELECT * FROM contacts WHERE institution_id = ? AND is_active=1 ORDER BY created_at ASC LIMIT 1',
    [req.params.id]
  );
  res.render('institutions/form', {
    title: 'Edit Institution', institution,
    primaryContact: primaryContact || null, statuses: STATUSES
  });
});

router.post('/:id/edit', async (req, res) => {
  const { name, institution_type, relationship_status, city, state, region, website, notes } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`
      UPDATE institutions SET name=?, institution_type=?, relationship_status=?,
        city=?, state=?, region=?, website=?, notes=?
      WHERE id=?
    `, [name, institution_type || null, relationship_status || 'Target',
        city || null, state || null, region || null, website || null, notes || null,
        req.params.id]);
    await savePrimaryContact(conn, req.params.id, req.body);
    await conn.commit();
    req.flash('success', 'Institution updated.');
    res.redirect(`/institutions/${req.params.id}`);
  } catch (err) {
    await conn.rollback();
    req.flash('error', 'Could not save: ' + err.message);
    res.redirect(`/institutions/${req.params.id}/edit`);
  } finally {
    conn.release();
  }
});

module.exports = router;
