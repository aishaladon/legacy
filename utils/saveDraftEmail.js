const MailComposer = require('nodemailer/lib/mail-composer');
const { createImapClient } = require('./imapClient');

// Builds a real RFC822 message (same MIME compiler nodemailer uses to send,
// just without actually sending) and APPENDs it into the mailbox's Drafts
// folder with the \Draft flag — so it shows up as an actual draft in
// whatever mail client points at IMAP_USERNAME (info@legacypnp.ltd), not
// just a pre-filled compose URL that needs the browser and Gmail open.
async function saveDraftEmail({ to, subject, body }) {
  if (!process.env.IMAP_USERNAME || !process.env.IMAP_PASSWORD) {
    throw new Error('IMAP_USERNAME / IMAP_PASSWORD not configured — cannot save to the mailbox.');
  }

  const composer = new MailComposer({
    from: process.env.IMAP_USERNAME,
    to: to || undefined,
    subject: subject || '(no subject)',
    text: body || ''
  });
  const raw = await new Promise((resolve, reject) => {
    composer.compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });

  const client = createImapClient();
  await client.connect();
  try {
    // Mailbox naming for the Drafts folder isn't standardized across
    // providers (Gmail: "[Gmail]/Drafts", many others: "Drafts" or
    // "INBOX.Drafts") — ask the server which mailbox it flags as the
    // special-use Drafts folder instead of guessing a name.
    const mailboxes = await client.list();
    const draftsBox = mailboxes.find(m => m.specialUse === '\\Drafts')
      || mailboxes.find(m => /drafts/i.test(m.path));

    if (!draftsBox) {
      throw new Error('Could not find a Drafts folder on this mailbox.');
    }

    await client.append(draftsBox.path, raw, ['\\Draft']);
  } finally {
    await client.logout().catch(() => {});
  }
}

module.exports = { saveDraftEmail };
