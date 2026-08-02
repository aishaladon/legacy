const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { dedupeFunders } = require('../database/migrations/dedupe_funders');
const { upgradeBidWritingGuides } = require('../database/migrations/upgrade_bid_writing_guides');
const { seedBidWritingGuides } = require('../database/seeds/bid_writing_guides');
const { updateNaicsCodes } = require('../database/migrations/update_naics_codes');

const SETUP_KEY = process.env.SETUP_KEY || 'legacy-setup-2026';

router.get('/setup', async (req, res) => {
  if (req.query.key !== SETUP_KEY) {
    return res.status(403).send('Forbidden. Add ?key=YOUR_SETUP_KEY to the URL.');
  }

  let log = [];
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });
    log.push('Connected to database.');

    const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    await conn.query(schema);
    log.push('Schema applied (all 18 tables created).');

    const seeds = [
      'database/seeds/naics_codes.sql',
      'database/seeds/keywords.sql',
      'database/seeds/funders.sql',
      'database/seeds/data_sources.sql',
      'database/seeds/user_settings.sql'
    ];

    for (const seedFile of seeds) {
      const sql = fs.readFileSync(path.join(__dirname, '../' + seedFile), 'utf8');
      try {
        await conn.query(sql);
        log.push(`Seeded: ${seedFile}`);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          log.push(`Already seeded: ${seedFile}`);
        } else {
          throw err;
        }
      }
    }

    const removed = await dedupeFunders(conn);
    log.push(removed > 0 ? `Removed ${removed} duplicate funder row(s).` : 'No duplicate funders found.');

    await upgradeBidWritingGuides(conn);
    const guidesAdded = await seedBidWritingGuides(conn);
    log.push(guidesAdded > 0 ? `Added ${guidesAdded} Bid Writing Guide(s).` : 'Bid Writing Guides already seeded.');

    const naicsRemoved = await updateNaicsCodes(conn);
    log.push(naicsRemoved > 0 ? `Removed ${naicsRemoved} outdated NAICS code(s).` : 'NAICS codes already current.');

    await conn.end();
    log.push('Database initialized successfully!');

    res.send(`<pre style="font-family:monospace;padding:2rem;background:#f0fdf4;color:#166534">` +
      `<b>Setup Complete</b>\n\n` + log.join('\n') +
      `\n\n<a href="/">Go to Dashboard</a></pre>`);

  } catch (err) {
    if (conn) await conn.end().catch(() => {});
    res.status(500).send(`<pre style="font-family:monospace;padding:2rem;background:#fef2f2;color:#991b1b">` +
      `<b>Setup Failed</b>\n\n` + log.join('\n') +
      `\n\nError: ${err.message}</pre>`);
  }
});

module.exports = router;
