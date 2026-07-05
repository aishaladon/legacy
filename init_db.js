require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

  await conn.end();
  console.log('Database initialized successfully.');
}

init().catch(err => {
  console.error('Init failed:', err.message);
  process.exit(1);
});
