// Fixes existing installs where bid_writing_guides had no UNIQUE key on
// `title` and no 'Subcontract' option in opportunity_type — the guides UI
// itself instructs users to create a Subcontract guide, but the column
// didn't allow that value. Safe to run repeatedly: both statements are
// idempotent no-ops once applied.
async function upgradeBidWritingGuides(conn) {
  try {
    await conn.query(
      "ALTER TABLE bid_writing_guides MODIFY COLUMN opportunity_type ENUM('Government Contract','Grant','Subcontract','RFP','NOFO','Other') NOT NULL DEFAULT 'Other'"
    );
  } catch (err) {
    throw err;
  }

  try {
    await conn.query('ALTER TABLE bid_writing_guides ADD UNIQUE KEY uniq_guides_title (title)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') throw err;
  }
}

module.exports = { upgradeBidWritingGuides };
