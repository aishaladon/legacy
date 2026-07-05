const express = require('express');
const router = express.Router();
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

// Auto-create tracking table on first use
db.query(`
  CREATE TABLE IF NOT EXISTS email_actions (
    uid VARCHAR(100) NOT NULL,
    action ENUM('converted','archived') NOT NULL,
    opportunity_id INT NULL,
    acted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (uid)
  )
`).catch(() => {});

// Keywords and sender domains that indicate an opportunity-related email
const OPPORTUNITY_KEYWORDS = [
  'contract', 'opportunity', 'opportunities', 'bid', 'grant', 'grants',
  'rfp', 'rfq', 'solicitation', 'procurement', 'award', 'federal',
  'govcon', 'sbir', 'sttr', 'proposal', 'subcontract', 'naics',
  'mybidmatch', 'govexpert', 'funding', 'government', 'sam.gov',
  'teaming', 'performance work', 'sources sought', 'notice'
];

const OPPORTUNITY_DOMAINS = [
  'govexpert.info', 'mybidmatch.com', 'sam.gov', 'grants.gov', 'sba.gov',
  'fpds.gov', 'usaspending.gov', 'governmentservicesexchange.com',
  'govwin.com', 'deltek.com', 'bgov.com'
];

function isOpportunityEmail(subject, from) {
  const s = (subject || '').toLowerCase();
  const f = (from || '').toLowerCase();
  if (OPPORTUNITY_DOMAINS.some(d => f.includes(d))) return true;
  if (OPPORTUNITY_KEYWORDS.some(k => s.includes(k))) return true;
  return false;
}

function createClient() {
  return new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_USE_SSL !== 'false',
    auth: {
      user: process.env.IMAP_USERNAME,
      pass: process.env.IMAP_PASSWORD
    },
    logger: false
  });
}

function formatFrom(envFrom) {
  if (!envFrom || !envFrom.length) return 'Unknown';
  const f = envFrom[0];
  if (f.name) return `${f.name} <${f.address}>`;
  return f.address || 'Unknown';
}

router.get('/', async (req, res) => {
  const showAll = req.query.show === 'all';
  const client = createClient();
  let messages = [];
  let error = null;

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX', { readOnly: true });
    const total = mailbox.exists;

    if (total > 0) {
      // Fetch recent emails — get enough to find 50 opportunity-related ones
      const fetchCount = Math.min(total, 200);
      const start = Math.max(1, total - fetchCount + 1);
      const raw = [];

      for await (const msg of client.fetch(`${start}:*`, {
        envelope: true,
        flags: true,
        uid: true
      })) {
        raw.push({
          uid: String(msg.uid),
          from: formatFrom(msg.envelope.from),
          fromAddress: msg.envelope.from?.[0]?.address || '',
          subject: msg.envelope.subject || '(no subject)',
          date: msg.envelope.date,
          seen: msg.flags.has('\\Seen')
        });
      }

      // Filter to opportunity emails only (unless showAll)
      const filtered = showAll
        ? raw
        : raw.filter(m => isOpportunityEmail(m.subject, m.from));

      // Check which UIDs have already been acted on
      const uids = filtered.map(m => m.uid);
      let actedMap = {};
      if (uids.length > 0) {
        const placeholders = uids.map(() => '?').join(',');
        const [rows] = await db.query(
          `SELECT uid, action, opportunity_id FROM email_actions WHERE uid IN (${placeholders})`,
          uids
        );
        rows.forEach(r => { actedMap[r.uid] = r; });
      }

      // Attach action status, exclude archived (unless showAll)
      messages = filtered
        .map(m => ({ ...m, action: actedMap[m.uid] || null }))
        .filter(m => showAll || !m.action || m.action.action !== 'archived')
        .reverse(); // newest first
    }

    await client.logout();
  } catch (err) {
    error = err.message;
    try { await client.logout(); } catch (_) {}
  }

  res.render('email_inbox/index', { title: 'Email Inbox', messages, error, showAll });
});

router.get('/:uid/convert', async (req, res) => {
  const uid = req.params.uid;
  const client = createClient();
  let email = null;
  let error = null;

  try {
    await client.connect();
    await client.mailboxOpen('INBOX', { readOnly: true });

    for await (const msg of client.fetch(uid, {
      envelope: true,
      source: true,
      uid: true
    }, { uid: true })) {
      const parsed = await simpleParser(msg.source);
      const bodyText = parsed.text || '';
      const truncated = bodyText.length > 3000
        ? bodyText.slice(0, 3000) + '\n\n[...email truncated...]'
        : bodyText;

      email = {
        uid: String(msg.uid),
        from: formatFrom(msg.envelope.from),
        fromAddress: msg.envelope.from?.[0]?.address || '',
        subject: msg.envelope.subject || '(no subject)',
        date: msg.envelope.date,
        body: truncated
      };
    }

    await client.logout();
  } catch (err) {
    error = err.message;
    try { await client.logout(); } catch (_) {}
  }

  if (!email) {
    req.flash('error', error || 'Email not found.');
    return res.redirect('/email-inbox');
  }

  res.render('email_inbox/convert', { title: 'Convert Email to Opportunity', email });
});

// Save opportunity and mark email as converted in one step
router.post('/:uid/save', async (req, res) => {
  const { uid } = req.params;
  const {
    title, opportunity_type, source, source_url, posted_date, due_date,
    amount_min, amount_max, description, region, status, is_starred
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO opportunities
        (title, opportunity_type, source, source_url, posted_date, due_date,
         amount_min, amount_max, description, region, status, is_starred)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      title, opportunity_type, source || null, source_url || null,
      posted_date || null, due_date || null,
      amount_min || null, amount_max || null,
      description || null, region || null,
      status || 'New', is_starred ? 1 : 0
    ]);

    const oppId = result.insertId;

    await db.query(
      'INSERT INTO activity_log (record_type, record_id, action, description) VALUES (?,?,?,?)',
      ['opportunity', oppId, 'created', `Created from email: ${title}`]
    );

    await db.query(
      `INSERT INTO email_actions (uid, action, opportunity_id) VALUES (?, 'converted', ?)
       ON DUPLICATE KEY UPDATE action='converted', opportunity_id=VALUES(opportunity_id), acted_at=NOW()`,
      [uid, oppId]
    );

    req.flash('success', 'Opportunity saved and email marked as converted.');
    res.redirect(`/opportunities/${oppId}`);
  } catch (err) {
    req.flash('error', 'Could not save opportunity: ' + err.message);
    res.redirect('/email-inbox');
  }
});

// Called after opportunity is saved — marks the source email as converted
router.post('/:uid/mark-converted', async (req, res) => {
  const { uid } = req.params;
  const { opportunity_id } = req.body;
  await db.query(
    `INSERT INTO email_actions (uid, action, opportunity_id) VALUES (?, 'converted', ?)
     ON DUPLICATE KEY UPDATE action='converted', opportunity_id=VALUES(opportunity_id), acted_at=NOW()`,
    [uid, opportunity_id || null]
  ).catch(() => {});
  res.redirect('/email-inbox');
});

router.post('/:uid/archive', async (req, res) => {
  const { uid } = req.params;
  await db.query(
    `INSERT INTO email_actions (uid, action) VALUES (?, 'archived')
     ON DUPLICATE KEY UPDATE action='archived', acted_at=NOW()`,
    [uid]
  ).catch(() => {});
  res.redirect('/email-inbox');
});

module.exports = router;
