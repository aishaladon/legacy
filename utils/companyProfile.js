const db = require('../config/database');

// Single source of truth for "who is this company, for AI prompts." Several
// Claude-powered features each independently queried user_settings for
// company_name/company_mission/company_capabilities/company_background,
// none of which are real setting names (the actual data lives in
// company_cage/company_uei/company_certifications, the naics_codes table,
// and the capability statement template in bid_writing_guides) — so those
// features always saw "(not specified)" regardless of what was configured.
async function getCompanyProfile() {
  let cage = '', uei = '', certifications = '', website = '';
  try {
    const [settings] = await db.query(
      "SELECT name, value FROM user_settings WHERE name IN ('company_cage', 'company_uei', 'company_certifications', 'company_website')"
    );
    settings.forEach(s => {
      if (s.name === 'company_cage') cage = s.value || '';
      if (s.name === 'company_uei') uei = s.value || '';
      if (s.name === 'company_certifications') certifications = s.value || '';
      if (s.name === 'company_website') website = s.value || '';
    });
  } catch (_) {}

  let naicsSummary = '(not specified)';
  try {
    const [naics] = await db.query(
      'SELECT code, description, is_primary FROM naics_codes ORDER BY is_primary DESC, code'
    );
    if (naics.length > 0) {
      naicsSummary = naics
        .map(n => `${n.code} (${n.description})${n.is_primary ? ' [primary]' : ''}`)
        .join(', ');
    }
  } catch (_) {}

  let capabilityStatement = '(not specified — add one in Bid Writing Guides, marked as a Template)';
  try {
    const [[guide]] = await db.query(
      'SELECT content FROM bid_writing_guides WHERE is_template = 1 ORDER BY sort_order LIMIT 1'
    );
    if (guide) capabilityStatement = guide.content;
  } catch (_) {}

  return {
    name: 'Legacy Planning & Preservation Ltd.',
    cage,
    uei,
    certifications,
    website,
    naicsSummary,
    capabilityStatement
  };
}

module.exports = { getCompanyProfile };
