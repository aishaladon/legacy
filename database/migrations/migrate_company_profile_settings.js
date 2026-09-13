// Regroups the company-identity settings (CAGE, UEI, certifications,
// website) under setting_type='Profile' so they render in the dedicated
// Company Profile section instead of the generic Configuration list they
// were dumped into alongside unrelated operational settings like backup
// destination and digest timing. Only affects installs seeded before this
// change — the seed file now creates them with the right type from the
// start. Safe to re-run: a no-op once already migrated.
async function migrateCompanyProfileSettings(conn) {
  const [result] = await conn.query(`
    UPDATE user_settings
    SET setting_type = 'Profile'
    WHERE name IN ('company_cage', 'company_uei', 'company_certifications', 'company_website')
      AND setting_type != 'Profile'
  `);
  return result.affectedRows;
}

module.exports = { migrateCompanyProfileSettings };
