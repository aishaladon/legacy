// Corrects the NAICS code list to the company's actual registered codes:
// - 519120 "Libraries & Archives" (2017 NAICS) is replaced by its 2022 NAICS
//   successor, 519210 "Libraries and Archives"
// - 611610 "Fine Arts Schools / Training" is removed — not a registered code
// - 712120 "Historical Sites" is added
// naics_codes has no foreign-key dependents, so this is a plain
// delete-and-upsert. Safe to run repeatedly.
const CURRENT_CODES = [
  ['519210', 'Libraries & Archives', 1],
  ['541990', 'Other Professional & Technical Services', 1],
  ['561410', 'Document Preparation Services', 1],
  ['518210', 'Computing Infrastructure & Hosting', 0],
  ['541511', 'Custom Computer Programming', 0],
  ['541512', 'Computer Systems Design', 0],
  ['541611', 'Administrative Management Consulting', 0],
  ['541922', 'Photographic Services / Digitization', 1],
  ['712110', 'Museums', 0],
  ['712120', 'Historical Sites', 0],
  ['561990', 'All Other Support Services', 0],
  ['611420', 'Computer Training', 0]
];

async function updateNaicsCodes(conn) {
  const codes = CURRENT_CODES.map(c => c[0]);
  const placeholders = codes.map(() => '?').join(',');

  const [result] = await conn.query(
    `DELETE FROM naics_codes WHERE code NOT IN (${placeholders})`,
    codes
  );

  for (const [code, description, isPrimary] of CURRENT_CODES) {
    await conn.query(
      `INSERT INTO naics_codes (code, description, is_primary) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), is_primary = VALUES(is_primary)`,
      [code, description, isPrimary]
    );
  }

  await conn.query(
    `UPDATE user_settings SET value = ? WHERE name = 'sam_gov_naics_codes'`,
    [codes.join(',')]
  );

  return result.affectedRows;
}

module.exports = { updateNaicsCodes };
