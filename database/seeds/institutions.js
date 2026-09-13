// Run once: node database/seeds/institutions.js
// Seeds target institutions for Legacy Planning & Preservation Ltd.
// Safe to re-run — skips any institution already in the DB by name.

require('dotenv').config();
const db = require('../../config/database');
const { institutions } = require('./institutions_data');

async function seed() {
  let added = 0;
  let skipped = 0;

  for (const inst of institutions) {
    const [existing] = await db.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [inst.name]);
    if (existing.length > 0) {
      skipped++;
      continue;
    }
    await db.query(`
      INSERT INTO institutions (name, institution_type, relationship_status, city, state, website, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [inst.name, inst.institution_type, inst.relationship_status,
        inst.city || null, inst.state || null, inst.website || null, inst.notes || null]);
    added++;
    process.stdout.write(`  + ${inst.name}\n`);
  }

  console.log(`\nDone. Added: ${added}, Skipped (already exists): ${skipped}`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
