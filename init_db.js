require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { dedupeFunders } = require('./database/migrations/dedupe_funders');
const { upgradeBidWritingGuides } = require('./database/migrations/upgrade_bid_writing_guides');
const { seedBidWritingGuides } = require('./database/seeds/bid_writing_guides');
const { updateNaicsCodes } = require('./database/migrations/update_naics_codes');
const { dedupeDataSources } = require('./database/migrations/dedupe_data_sources');
const { scoreAllUnscored } = require('./services/alignmentScorer');

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  console.log('Connected to database.');

  const schema = fs.readFileSync(path.join(__dirname, 'database/schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('Schema applied.');

  const seeds = [
    'database/seeds/naics_codes.sql',
    'database/seeds/keywords.sql',
    'database/seeds/funders.sql',
    'database/seeds/data_sources.sql',
    'database/seeds/user_settings.sql'
  ];

  for (const seedFile of seeds) {
    const sql = fs.readFileSync(path.join(__dirname, seedFile), 'utf8');
    try {
      await conn.query(sql);
      console.log(`Seeded: ${seedFile}`);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        console.log(`Skipped (already seeded): ${seedFile}`);
      } else {
        throw err;
      }
    }
  }

  const removed = await dedupeFunders(conn);
  if (removed > 0) console.log(`Removed ${removed} duplicate funder row(s).`);

  const dataSourcesRemoved = await dedupeDataSources(conn);
  if (dataSourcesRemoved > 0) console.log(`Removed ${dataSourcesRemoved} duplicate data source row(s).`);

  await upgradeBidWritingGuides(conn);
  const guidesAdded = await seedBidWritingGuides(conn);
  console.log(`Bid Writing Guides: ${guidesAdded} added.`);

  const naicsRemoved = await updateNaicsCodes(conn);
  if (naicsRemoved > 0) console.log(`Removed ${naicsRemoved} outdated NAICS code(s).`);

  const scored = await scoreAllUnscored();
  if (scored > 0) console.log(`Alignment score computed for ${scored} previously-unscored opportunit${scored === 1 ? 'y' : 'ies'}.`);

  await conn.end();
  console.log('Database initialized successfully.');
}

init().catch(err => {
  console.error('Init failed:', err.message);
  process.exit(1);
});
