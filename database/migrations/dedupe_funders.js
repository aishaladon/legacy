// Fixes existing installs where `funders` had no UNIQUE key on `name`, so
// re-running the seed (via init_db.js or /setup) inserted duplicate rows
// each time. Safe to run repeatedly: the dedupe is a no-op once duplicates
// are gone, and the ALTER TABLE is skipped if the key already exists.
async function dedupeFunders(conn) {
  await conn.query(`
    UPDATE grant_opportunities go
    JOIN funders dup ON go.funder_id = dup.id
    JOIN (SELECT name, MIN(id) AS keep_id FROM funders GROUP BY name) canon
      ON canon.name = dup.name AND canon.keep_id <> dup.id
    SET go.funder_id = canon.keep_id
  `);

  const [result] = await conn.query(`
    DELETE dup FROM funders dup
    JOIN (SELECT name, MIN(id) AS keep_id FROM funders GROUP BY name) canon
      ON canon.name = dup.name AND canon.keep_id <> dup.id
  `);

  try {
    await conn.query('ALTER TABLE funders ADD UNIQUE KEY uniq_funders_name (name)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }

  return result.affectedRows;
}

module.exports = { dedupeFunders };
