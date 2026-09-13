const { ImapFlow } = require('imapflow');

// Single source of truth for the IMAP_* env vars — used by the Email Inbox
// reader (routes/email_inbox.js) and by anything that needs to write back
// into the same mailbox (e.g. saving an AI-drafted outreach email as a real
// Draft). Keeping the connection config in one place means a credential
// change in .env only has to be right once.
function createImapClient() {
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

module.exports = { createImapClient };
