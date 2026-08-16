const nodemailer = require('nodemailer');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const db = require('../config/database');

// Hostinger's Node hosting doesn't guarantee a `mysqldump` binary is
// reachable from a spawned subprocess, so this dumps the database in pure
// JS/SQL instead of shelling out — every table's rows re-serialized as
// DELETE + INSERT statements, restorable with any MySQL client or
// phpMyAdmin's Import tab.
async function generateSqlBackup() {
  const [tables] = await db.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0] || {})[0];
  const tableNames = tables.map(t => t[tableKey]);

  let sql = `-- Legacy GovCon database backup\n-- Generated: ${new Date().toISOString()}\n-- Restoring this OVERWRITES current data in each table listed below.\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`;
  let totalRows = 0;

  for (const table of tableNames) {
    const [rows] = await db.query(`SELECT * FROM \`${table}\``);
    sql += `-- Table: ${table} (${rows.length} row${rows.length === 1 ? '' : 's'})\nDELETE FROM \`${table}\`;\n`;
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      for (const row of rows) {
        const values = columns.map(col => db.escape(row[col]));
        sql += `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES (${values.join(',')});\n`;
      }
      totalRows += rows.length;
    }
    sql += '\n';
  }

  sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
  return { sql, tableCount: tableNames.length, rowCount: totalRows };
}

// Zips the .sql text into an in-memory buffer — a real .zip archive so it
// opens with a double-click on Windows or Mac with no extra software,
// unlike .gz which Windows doesn't handle natively.
function buildZipBuffer(sql, entryName) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = new PassThrough();
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    archive.pipe(stream);
    archive.append(sql, { name: entryName });
    archive.finalize();
  });
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

function looksLikeEmail(value) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function getSetting(name) {
  const [[row]] = await db.query('SELECT value FROM user_settings WHERE name = ?', [name]);
  return row ? row.value : null;
}

// Runs a backup and emails it (zipped) to backup_destination. Logs every
// attempt — sent, failed, or skipped — to automation_log, same pattern as
// the SAM.gov/Grants.gov pulls, so Settings shows real history instead of
// silently doing nothing.
async function runBackup() {
  const destination = (await getSetting('backup_destination') || '').trim();

  if (!looksLikeEmail(destination)) {
    const message = destination
      ? `"${destination}" in Backup Destination doesn't look like an email address — set a valid email to receive backups.`
      : 'No Backup Destination email set in Settings → General.';
    await db.query(
      'INSERT INTO automation_log (run_type, status, message) VALUES (?,?,?)',
      ['backup', 'skipped', message]
    );
    return { status: 'skipped', message };
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USERNAME || !process.env.SMTP_PASSWORD) {
    const message = 'SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD not set in environment variables.';
    await db.query(
      'INSERT INTO automation_log (run_type, status, message) VALUES (?,?,?)',
      ['backup', 'skipped', message]
    );
    return { status: 'skipped', message };
  }

  try {
    const { sql, tableCount, rowCount } = await generateSqlBackup();
    const today = new Date().toISOString().split('T')[0];
    const zipBuffer = await buildZipBuffer(sql, `legacy-govcon-backup-${today}.sql`);

    const transporter = buildTransporter();
    await transporter.sendMail({
      from: process.env.DIGEST_FROM || process.env.SMTP_USERNAME,
      to: destination,
      subject: `Legacy GovCon — Database Backup (${today})`,
      text: `Attached: a full database backup generated ${new Date().toLocaleString('en-US')}.\n\n${tableCount} tables, ${rowCount} rows.\n\nTo restore: unzip the attachment to get a .sql file, then in Hostinger hPanel go to Databases → phpMyAdmin, select this database, open the Import tab, choose that .sql file, and click Go. This replaces current data with what's in the backup — it does not merge.`,
      attachments: [{
        filename: `legacy-govcon-backup-${today}.zip`,
        content: zipBuffer
      }]
    });

    const message = `Backup emailed to ${destination} — ${tableCount} tables, ${rowCount} rows, ${(zipBuffer.length / 1024).toFixed(0)} KB zipped.`;
    await db.query(
      'INSERT INTO automation_log (run_type, status, items_found, message) VALUES (?,?,?,?)',
      ['backup', 'success', rowCount, message]
    );
    return { status: 'success', message, rowCount, tableCount };
  } catch (err) {
    const message = err.message;
    await db.query(
      'INSERT INTO automation_log (run_type, status, message) VALUES (?,?,?)',
      ['backup', 'error', message]
    );
    return { status: 'error', message };
  }
}

module.exports = { generateSqlBackup, buildZipBuffer, runBackup, looksLikeEmail };
