const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const { getClaudeApiKey } = require('../utils/claudeApiKey');
const { extractResponseText } = require('../utils/claudeResponseText');
const { getCompanyProfile } = require('../utils/companyProfile');

router.use(requireLogin);

const COMM_TYPES = ['Email', 'Call', 'Meeting', 'Other'];

// Self-provisioning, same as contacts.js — the communications table only
// existed in schema.sql, not the live database, until /setup was re-run.
db.query(`
  CREATE TABLE IF NOT EXISTS communications (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    institution_id INT          DEFAULT NULL,
    contact_id     INT          DEFAULT NULL,
    comm_type      ENUM('Email','Call','Meeting','Other') NOT NULL DEFAULT 'Email',
    direction      ENUM('Outbound','Inbound') NOT NULL DEFAULT 'Outbound',
    subject        VARCHAR(300) DEFAULT NULL,
    notes          TEXT         DEFAULT NULL,
    logged_at      DATE         NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id)     REFERENCES contacts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(() => {});

// Auto-migrate relationship_status column for existing installs
db.query(`
  ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS relationship_status
    ENUM('Target','Prospect','Partner','Client','Vendor') DEFAULT 'Target'
`).catch(() => {});

// Street address, zip, and phone for existing installs
db.query("ALTER TABLE institutions ADD COLUMN IF NOT EXISTS address VARCHAR(255) DEFAULT NULL AFTER relationship_status").catch(() => {});
db.query("ALTER TABLE institutions ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20) DEFAULT NULL AFTER state").catch(() => {});
db.query("ALTER TABLE institutions ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT NULL AFTER region").catch(() => {});

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
  const {
    name, institution_type, relationship_status, address, city, state,
    zip_code, region, phone, website, notes
  } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(`
      INSERT INTO institutions
        (name, institution_type, relationship_status, address, city, state, zip_code, region, phone, website, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, [name, institution_type || null, relationship_status || 'Target',
        address || null, city || null, state || null, zip_code || null,
        region || null, phone || null, website || null, notes || null]);
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
  const [communications] = await db.query(`
    SELECT c.*, ct.first_name, ct.last_name
    FROM communications c
    LEFT JOIN contacts ct ON ct.id = c.contact_id
    WHERE c.institution_id = ?
    ORDER BY c.logged_at DESC, c.created_at DESC
  `, [req.params.id]);

  res.render('institutions/detail', {
    title: institution.name, institution, contacts, awards, opportunities, projects,
    communications, commTypes: COMM_TYPES
  });
});

// Log a communication (email/call/meeting) with this institution
router.post('/:id/communications', async (req, res) => {
  const { comm_type, direction, contact_id, subject, notes, logged_at } = req.body;
  await db.query(`
    INSERT INTO communications (institution_id, contact_id, comm_type, direction, subject, notes, logged_at)
    VALUES (?,?,?,?,?,?,?)
  `, [
    req.params.id,
    contact_id || null,
    COMM_TYPES.includes(comm_type) ? comm_type : 'Email',
    direction === 'Inbound' ? 'Inbound' : 'Outbound',
    subject || null,
    notes || null,
    logged_at || new Date().toISOString().split('T')[0]
  ]);
  req.flash('success', 'Communication logged.');
  res.redirect(`/institutions/${req.params.id}#communications`);
});

router.post('/:id/communications/:commId/delete', async (req, res) => {
  await db.query('DELETE FROM communications WHERE id = ? AND institution_id = ?', [req.params.commId, req.params.id]);
  req.flash('success', 'Communication log entry removed.');
  res.redirect(`/institutions/${req.params.id}#communications`);
});

// Draft a personalized outreach email with Claude, using the company's
// capability statement/NAICS/certifications and this institution's info.
router.get('/:id/draft-outreach', async (req, res) => {
  const [[institution]] = await db.query('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
  if (!institution) { req.flash('error', 'Not found.'); return res.redirect('/institutions'); }
  const [[primaryContact]] = await db.query(
    'SELECT * FROM contacts WHERE institution_id = ? AND is_active=1 ORDER BY created_at ASC LIMIT 1',
    [req.params.id]
  );
  res.render('institutions/draft-outreach', { title: 'Draft Outreach Email', institution, primaryContact });
});

router.post('/:id/draft-outreach-api', async (req, res) => {
  const [[institution]] = await db.query('SELECT * FROM institutions WHERE id = ?', [req.params.id]);
  if (!institution) return res.status(404).json({ error: 'Institution not found.' });

  const apiKey = await getClaudeApiKey();
  if (!apiKey) return res.status(500).json({ error: 'Claude API key not set. Go to Settings → API Keys to add it.' });

  const company = await getCompanyProfile();
  const { contact_name, notes: extraNotes } = req.body;

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `Draft a short, professional introductory outreach email from ${company.name} to a target institution, aimed at opening a relationship for future government contract or grant work.

OUR COMPANY:
Name: ${company.name}
Website: ${company.website || '(not specified)'}
NAICS Codes: ${company.naicsSummary}
Certifications: ${company.certifications || '(not specified)'}

CAPABILITY STATEMENT / BOILERPLATE (draw on this for what to highlight, don't paste it verbatim):
${company.capabilityStatement}

TARGET INSTITUTION:
Name: ${institution.name}
Type: ${institution.institution_type || '(not specified)'}
Location: ${[institution.city, institution.state].filter(Boolean).join(', ') || '(not specified)'}
Relationship status: ${institution.relationship_status}
Notes on file: ${institution.notes || '(none)'}
${contact_name ? `Addressing: ${contact_name}` : 'No specific contact name — address generically (e.g. "Hello,").'}
${extraNotes ? `Additional context from the user for this specific email: ${extraNotes}` : ''}

Write a concise (150-250 word) email that:
1. Briefly introduces the company and what it does
2. Names 1-2 specific capabilities relevant to what this type of institution would need (based on the capability statement and the institution's type/notes — don't just list everything)
3. Mentions the website as a way to learn more
4. Ends with a low-pressure call to action (e.g. a short call, or happy to send the full capability statement)
5. Is warm but professional, not salesy or generic-sounding

Respond ONLY with valid JSON (no markdown): {"subject": "...", "body": "..."}. The body should use \\n for line breaks, no markdown formatting, ready to paste into an email.`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = extractResponseText(response).trim();
    let draft;
    try {
      draft = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Could not parse the draft — try again.' });
    }

    res.json(draft);
  } catch (err) {
    console.error('Claude API error:', err);
    let errorMsg = 'Draft generation failed. Please try again.';
    if (err.status === 401) errorMsg = 'Invalid Claude API key — check it in Settings → API Keys.';
    else if (err.status === 429) errorMsg = 'Rate limited — too many requests. Wait a moment and try again.';
    res.status(500).json({ error: errorMsg });
  }
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
  const {
    name, institution_type, relationship_status, address, city, state,
    zip_code, region, phone, website, notes
  } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`
      UPDATE institutions SET name=?, institution_type=?, relationship_status=?,
        address=?, city=?, state=?, zip_code=?, region=?, phone=?, website=?, notes=?
      WHERE id=?
    `, [name, institution_type || null, relationship_status || 'Target',
        address || null, city || null, state || null, zip_code || null,
        region || null, phone || null, website || null, notes || null,
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

router.post('/:id/delete', async (req, res) => {
  await db.query('UPDATE institutions SET is_active = 0 WHERE id = ?', [req.params.id]);
  req.flash('success', 'Institution deleted.');
  res.redirect('/institutions');
});

module.exports = router;
