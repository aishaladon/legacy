const express = require('express');
const router = express.Router();
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

function createClient() {
  return new ImapFlow({
    host: process.env.IMAP_HOST || 'mail.legacypnp.ltd',
    port: parseInt(process.env.IMAP_PORT) || 993,
    secure: process.env.IMAP_USE_SSL !== 'false',
    auth: {
      user: process.env.IMAP_USERNAME || 'info@legacypnp.ltd',
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
  const client = createClient();
  let messages = [];
  let error = null;

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX', { readOnly: true });
    const total = mailbox.exists;

    if (total > 0) {
      const start = Math.max(1, total - 49);
      const msgs = [];
      for await (const msg of client.fetch(`${start}:*`, {
        envelope: true,
        flags: true,
        uid: true
      })) {
        msgs.push({
          uid: msg.uid,
          from: formatFrom(msg.envelope.from),
          subject: msg.envelope.subject || '(no subject)',
          date: msg.envelope.date,
          seen: msg.flags.has('\\Seen')
        });
      }
      messages = msgs.reverse();
    }

    await client.logout();
  } catch (err) {
    error = err.message;
    try { await client.logout(); } catch (_) {}
  }

  res.render('email_inbox/index', { title: 'Email Inbox', messages, error });
});

router.get('/:uid/convert', async (req, res) => {
  const uid = parseInt(req.params.uid);
  if (!uid) { req.flash('error', 'Invalid email ID.'); return res.redirect('/email-inbox'); }

  const client = createClient();
  let email = null;
  let error = null;

  try {
    await client.connect();
    await client.mailboxOpen('INBOX', { readOnly: true });

    for await (const msg of client.fetch(String(uid), {
      envelope: true,
      source: true,
      uid: true
    }, { uid: true })) {
      const parsed = await simpleParser(msg.source);
      const bodyText = parsed.text || '';
      const truncated = bodyText.length > 3000 ? bodyText.slice(0, 3000) + '\n\n[...email truncated...]' : bodyText;

      email = {
        uid: msg.uid,
        from: formatFrom(msg.envelope.from),
        fromAddress: msg.envelope.from?.[0]?.address || '',
        subject: msg.envelope.subject || '(no subject)',
        date: msg.envelope.date,
        body: truncated,
        preview: bodyText.slice(0, 300).replace(/\n+/g, ' ')
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

module.exports = router;
