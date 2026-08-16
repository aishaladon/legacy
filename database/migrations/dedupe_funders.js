// Fixes existing installs where `funders` had no UNIQUE key on `name`, so
// re-running the seed (via init_db.js or /setup) inserted duplicate rows
// each time. Safe to run repeatedly: the dedupe is a no-op once duplicates
// are gone, and the ALTER TABLE is skipped if the key already exists.
//
// Also catches NEAR-duplicates that an exact-name match misses: the seed
// data names funders "ABBREV — Full Name" (e.g. "NEH — National Endowment
// for the Humanities"), but a Grants.gov save with no matching funder
// inserts whatever the API's plain agency name is (e.g. "National Endowment
// for the Humanities") as a brand-new row instead of matching the seeded
// one. Normalize by stripping any "ABBREV — " prefix before comparing, same
// as routes/grants_search.js does when saving a new grant.
function normalizeFunderName(name) {
  return String(name || '').replace(/^.*?—\s*/, '').trim().toLowerCase();
}

async function dedupeFunders(conn) {
  const [rows] = await conn.query('SELECT id, name FROM funders ORDER BY id');

  const groups = new Map();
  for (const row of rows) {
    const key = normalizeFunderName(row.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  let removed = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    // Prefer the "ABBREV — Full Name" seeded form as canonical when present;
    // otherwise keep the lowest id.
    const canonical = group.find(f => /^\S.*?—\s*/.test(f.name)) || group[0];
    const dupes = group.filter(f => f.id !== canonical.id);
    const dupeIds = dupes.map(f => f.id);

    await conn.query('UPDATE grant_opportunities SET funder_id = ? WHERE funder_id IN (?)', [canonical.id, dupeIds]);
    const [result] = await conn.query('DELETE FROM funders WHERE id IN (?)', [dupeIds]);
    removed += result.affectedRows;
  }

  // Leftover manual QA/test data with no legitimate use — remove outright
  // rather than merging (there's nothing real to merge it into).
  const [testResult] = await conn.query("DELETE FROM funders WHERE name = 'QA Test Funder'");
  removed += testResult.affectedRows;

  try {
    await conn.query('ALTER TABLE funders ADD UNIQUE KEY uniq_funders_name (name)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }

  return removed;
}

module.exports = { dedupeFunders };
