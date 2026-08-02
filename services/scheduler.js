const cron = require('node-cron');
const db = require('../config/database');

// Auto-create automation_log table
db.query(`
  CREATE TABLE IF NOT EXISTS automation_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_type VARCHAR(50) NOT NULL,
    status ENUM('success','error','skipped') NOT NULL,
    items_found INT DEFAULT 0,
    items_new INT DEFAULT 0,
    message TEXT,
    ran_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).catch(() => {});

// Ensure automation toggle settings exist
db.query(`
  INSERT IGNORE INTO user_settings (name, value, setting_type, description)
  VALUES
    ('auto_sam_enabled',    '0', 'Toggle', 'Enable daily SAM.gov opportunity digest'),
    ('auto_grants_enabled', '0', 'Toggle', 'Enable daily Grants.gov deadline pull'),
    ('auto_digest_enabled', '0', 'Toggle', 'Enable the daily opportunity digest email')
`).catch(() => {});

// ── SAM.gov Digest ────────────────────────────────────────────────────────────
async function runSamDigest() {
  const apiKey = process.env.SAM_API_KEY;
  if (!apiKey) {
    await db.query(
      'INSERT INTO automation_log (run_type, status, message) VALUES (?,?,?)',
      ['sam_digest', 'skipped', 'SAM_API_KEY not configured in environment variables']
    );
    return { status: 'skipped', message: 'SAM_API_KEY not set' };
  }

  const [[row]] = await db.query("SELECT value FROM user_settings WHERE name='auto_sam_enabled'");
  if (!row || row.value !== '1') return null;

  try {
    const [keywordRows] = await db.query('SELECT keyword FROM keywords ORDER BY priority, keyword');
    const q = keywordRows.map(r => r.keyword).slice(0, 6).join(' OR ') || 'historic preservation';

    const today = new Date();
    const yesterday = new Date(today - 24 * 60 * 60 * 1000);
    const fmt = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;

    const url = `https://api.sam.gov/opportunities/v2/search?api_key=${apiKey}` +
      `&q=${encodeURIComponent(q)}&postedFrom=${fmt(yesterday)}&postedTo=${fmt(today)}` +
      `&ptype=o,k,s,p&limit=100`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`SAM API ${resp.status}: ${txt.slice(0, 200)}`);
    }

    const data = await resp.json();
    const items = data.opportunitiesData || [];
    let newCount = 0;

    for (const item of items) {
      const link = item.uiLink || `https://sam.gov/opp/${item.noticeId}`;
      const [existing] = await db.query('SELECT id FROM opportunities WHERE source_url = ? LIMIT 1', [link]);
      if (existing.length > 0) continue;

      const dueDate = item.responseDeadLine ? item.responseDeadLine.split(' ')[0] : null;
      const desc = [
        item.fullParentPathName ? `Agency: ${item.fullParentPathName}` : '',
        item.naicsCode ? `NAICS: ${item.naicsCode}` : '',
        item.type ? `Type: ${item.type}` : ''
      ].filter(Boolean).join(' | ');

      await db.query(`
        INSERT INTO opportunities (title, opportunity_type, source, source_url, posted_date, due_date, description, status)
        VALUES (?,?,?,?,?,?,?,?)
      `, [
        (item.title || 'Untitled').slice(0, 255),
        'Government Contract',
        item.fullParentPathName ? item.fullParentPathName.split('::')[0].trim() : 'SAM.gov',
        link,
        item.postedDate || null,
        dueDate,
        desc || null,
        'New'
      ]);
      newCount++;
    }

    const msg = `SAM.gov: ${items.length} found, ${newCount} new opportunities added`;
    await db.query(
      'INSERT INTO automation_log (run_type, status, items_found, items_new, message) VALUES (?,?,?,?,?)',
      ['sam_digest', 'success', items.length, newCount, msg]
    );
    return { status: 'success', newCount };
  } catch (err) {
    const detail = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
    await db.query(
      'INSERT INTO automation_log (run_type, status, message) VALUES (?,?,?)',
      ['sam_digest', 'error', detail]
    );
    return { status: 'error', message: detail };
  }
}

// ── Grants.gov Deadline Pull ──────────────────────────────────────────────────
async function runGrantsPull() {
  const [[row]] = await db.query("SELECT value FROM user_settings WHERE name='auto_grants_enabled'");
  if (!row || row.value !== '1') return null;

  try {
    const [keywordRows] = await db.query('SELECT keyword FROM keywords ORDER BY priority, keyword');
    const keyword = keywordRows.map(r => r.keyword).slice(0, 4).join(' ') || 'historic preservation';

    const resp = await fetch('https://apply07.grants.gov/grantsws/rest/opportunities/search/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        keyword,
        oppStatuses: 'posted',
        rows: 50,
        startRecordNum: 0,
        sortBy: 'openDate|desc'
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!resp.ok) throw new Error(`Grants.gov API ${resp.status}`);

    const data = await resp.json();
    const items = data.oppHits || [];
    let newCount = 0;

    for (const item of items) {
      const link = `https://www.grants.gov/search-results-detail/${item.id}`;
      const [existing] = await db.query('SELECT id FROM opportunities WHERE source_url = ? LIMIT 1', [link]);
      if (existing.length > 0) continue;

      const parseDate = s => (s ? s.split('T')[0] : null);

      await db.query(`
        INSERT INTO opportunities (title, opportunity_type, source, source_url, posted_date, due_date, description, status)
        VALUES (?,?,?,?,?,?,?,?)
      `, [
        (item.title || 'Untitled').slice(0, 255),
        'Grant',
        item.agencyName || 'Grants.gov',
        link,
        parseDate(item.openDate),
        parseDate(item.closeDate),
        item.synopsis ? item.synopsis.slice(0, 500) : null,
        'New'
      ]);
      newCount++;
    }

    const msg = `Grants.gov: ${items.length} found, ${newCount} new opportunities added`;
    await db.query(
      'INSERT INTO automation_log (run_type, status, items_found, items_new, message) VALUES (?,?,?,?,?)',
      ['grants_pull', 'success', items.length, newCount, msg]
    );
    return { status: 'success', newCount };
  } catch (err) {
    const detail = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
    await db.query(
      'INSERT INTO automation_log (run_type, status, message) VALUES (?,?,?)',
      ['grants_pull', 'error', detail]
    );
    return { status: 'error', message: detail };
  }
}

// ── Daily Opportunity Digest ───────────────────────────────────────────────────
// Delivery time is user-configurable (Settings → digest_delivery_time), so
// this can't use a fixed cron expression like the pulls above — instead it
// checks every 5 minutes whether the configured HH:MM has arrived (in the
// configured timezone) and whether a digest has already gone out today.
async function maybeRunDigest() {
  const [[enabledRow]] = await db.query("SELECT value FROM user_settings WHERE name='auto_digest_enabled'");
  if (!enabledRow || enabledRow.value !== '1') return;

  const [[timeRow]] = await db.query("SELECT value FROM user_settings WHERE name='digest_delivery_time'");
  const [[tzRow]] = await db.query("SELECT value FROM user_settings WHERE name='timezone'");
  const deliveryHour = ((timeRow && timeRow.value) || '07:00').slice(0, 2);
  const tz = (tzRow && tzRow.value) || 'America/Los_Angeles';

  const nowHour = new Date().toLocaleString('en-US', { timeZone: tz, hour: '2-digit', hour12: false });
  if (nowHour.slice(0, 2) !== deliveryHour) return;

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const [[already]] = await db.query(
    "SELECT id FROM daily_digests WHERE status='Sent' AND DATE(sent_at) = ?", [todayStr]
  );
  if (already) return;

  const { sendDailyDigest } = require('./digestMailer');
  await sendDailyDigest();
}

// ── Schedule: daily 7:00 AM server time ──────────────────────────────────────
cron.schedule('0 7 * * *', () => {
  runSamDigest();
  runGrantsPull();
});

cron.schedule('*/5 * * * *', maybeRunDigest);

module.exports = { runSamDigest, runGrantsPull, maybeRunDigest };
