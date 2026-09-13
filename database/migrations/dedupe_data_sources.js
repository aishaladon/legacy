// Fixes existing installs where `data_sources` had no UNIQUE key on `name`,
// so re-running the seed (via init_db.js or /setup) inserted duplicate rows
// each time — confirmed live: every source appeared 3x after 3 setup runs.
// No table has a foreign key into data_sources, so this is a plain
// delete-duplicates-then-add-key migration, no FK repointing needed. Safe
// to run repeatedly: the dedupe is a no-op once duplicates are gone, and
// the ALTER TABLE is skipped if the key already exists.
async function dedupeDataSources(conn) {
  const [result] = await conn.query(`
    DELETE dup FROM data_sources dup
    JOIN (SELECT name, MIN(id) AS keep_id FROM data_sources GROUP BY name) canon
      ON canon.name = dup.name AND canon.keep_id <> dup.id
  `);

  try {
    await conn.query('ALTER TABLE data_sources ADD UNIQUE KEY uniq_data_sources_name (name)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }

  return result.affectedRows;
}

module.exports = { dedupeDataSources };
