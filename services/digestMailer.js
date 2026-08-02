const nodemailer = require('nodemailer');
const db = require('../config/database');

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function getSetting(name) {
  const [[row]] = await db.query('SELECT value FROM user_settings WHERE name = ?', [name]);
  return row ? row.value : null;
}

function buildTransporter() {
  const port = parseInt(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: process.env.SMTP_USE_TLS !== 'false' && port !== 465,
    auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD }
  });
}

function buildDigestHtml(opportunities, baseUrl) {
  if (opportunities.length === 0) {
    return '<p>No new opportunities were added to govcon in the last 24 hours.</p>';
  }
  const rows = opportunities.map(o => {
    const link = baseUrl ? `${baseUrl}/opportunities/${o.id}` : `/opportunities/${o.id}`;
    const parts = [
      escapeHtml(o.opportunity_type),
      o.source ? escapeHtml(o.source) : '',
      o.due_date ? `Due ${new Date(o.due_date).toLocaleDateString('en-US')}` : '',
      o.alignment_score != null ? `Fit ${o.alignment_score}/10` : ''
    ].filter(Boolean).join(' &middot; ');
    return `<li><a href="${link}"><strong>${escapeHtml(o.title)}</strong></a><br><span style="color:#666;font-size:.85em;">${parts}</span></li>`;
  }).join('');
  return `<p>${opportunities.length} new opportunit${opportunities.length === 1 ? 'y' : 'ies'} added to govcon in the last 24 hours:</p><ul>${rows}</ul>`;
}

// Pulls opportunities added since the last digest window, filtered by the
// minimum amount / alignment score settings (only applied when an
// opportunity actually has that field set, so items missing that data
// aren't silently excluded), and emails a summary via SMTP. Logs every
// attempt — sent, failed, or skipped — to daily_digests so the Digest Log
// page has a real history instead of always being empty.
async function sendDailyDigest() {
  const recipient = (await getSetting('digest_email_address') || '').trim();
  if (!recipient) {
    await db.query(
      `INSERT INTO daily_digests (recipient, subject, opportunities_count, status, error_message) VALUES (?,?,?,?,?)`,
      [null, null, 0, 'Skipped', 'digest_email_address setting is empty — set it in Settings → General.']
    );
    return { status: 'skipped', message: 'No recipient configured' };
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USERNAME || !process.env.SMTP_PASSWORD) {
    await db.query(
      `INSERT INTO daily_digests (recipient, subject, opportunities_count, status, error_message) VALUES (?,?,?,?,?)`,
      [recipient, null, 0, 'Skipped', 'SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD not set in environment variables.']
    );
    return { status: 'skipped', message: 'SMTP not configured' };
  }

  const minAmount = parseFloat(await getSetting('minimum_contract_amount')) || 0;
  const minScore = parseFloat(await getSetting('minimum_alignment_score')) || 0;

  const [opportunities] = await db.query(`
    SELECT id, title, opportunity_type, source, due_date, amount_max, alignment_score
    FROM opportunities
    WHERE created_at >= NOW() - INTERVAL 1 DAY
      AND (amount_max IS NULL OR amount_max >= ?)
      AND (alignment_score IS NULL OR alignment_score >= ?)
    ORDER BY alignment_score DESC, created_at DESC
  `, [minAmount, minScore]);

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const subject = `Legacy GovCon — Daily Opportunity Digest (${opportunities.length}) — ${today}`;
  const bodyHtml = buildDigestHtml(opportunities, process.env.APP_URL || '');

  try {
    const transporter = buildTransporter();
    await transporter.sendMail({
      from: process.env.DIGEST_FROM || process.env.SMTP_USERNAME,
      to: recipient,
      subject,
      html: bodyHtml
    });
    await db.query(
      `INSERT INTO daily_digests (recipient, subject, opportunities_count, body_html, status) VALUES (?,?,?,?,?)`,
      [recipient, subject, opportunities.length, bodyHtml, 'Sent']
    );
    return { status: 'success', count: opportunities.length };
  } catch (err) {
    await db.query(
      `INSERT INTO daily_digests (recipient, subject, opportunities_count, body_html, status, error_message) VALUES (?,?,?,?,?,?)`,
      [recipient, subject, opportunities.length, bodyHtml, 'Failed', err.message]
    );
    return { status: 'error', message: err.message };
  }
}

module.exports = { sendDailyDigest, buildDigestHtml, escapeHtml };
