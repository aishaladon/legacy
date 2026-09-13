const db = require('../config/database');

// Settings has a full scoring configuration (keyword weights, NAICS weight,
// region weight, set-aside weight) that nothing in the app ever actually
// applied — every opportunity read "Not scored" regardless of how well it
// matched. This computes a weighted score from that existing configuration.
async function getScoringSettings() {
  const [rows] = await db.query(`
    SELECT name, value FROM user_settings WHERE name IN (
      'alignment_naics_weight', 'alignment_keyword_high_weight',
      'alignment_keyword_med_weight', 'alignment_keyword_low_weight',
      'alignment_set_aside_weight', 'alignment_region_weight',
      'preferred_regions', 'company_certifications'
    )
  `);
  const map = {};
  rows.forEach(r => { map[r.name] = r.value; });
  return map;
}

const PRIORITY_WEIGHT_KEY = {
  High: 'alignment_keyword_high_weight',
  Medium: 'alignment_keyword_med_weight',
  Low: 'alignment_keyword_low_weight'
};

async function computeAlignmentScore(opp) {
  const settings = await getScoringSettings();
  const num = (key) => parseFloat(settings[key]) || 0;
  const preferredRegions = (settings.preferred_regions || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const certifications = (settings.company_certifications || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const text = `${opp.title || ''} ${opp.description || ''}`.toLowerCase();
  const matched = [];
  let points = 0;

  const [keywords] = await db.query('SELECT keyword, priority FROM keywords');
  keywords.forEach(k => {
    const kw = (k.keyword || '').toLowerCase().trim();
    if (kw && text.includes(kw)) {
      points += num(PRIORITY_WEIGHT_KEY[k.priority] || 'alignment_keyword_low_weight');
      matched.push(`${k.keyword} (${k.priority})`);
    }
  });

  if (opp.naics_code) {
    const [naicsRows] = await db.query('SELECT id FROM naics_codes WHERE code = ? LIMIT 1', [opp.naics_code]);
    if (naicsRows.length > 0) {
      points += num('alignment_naics_weight');
      matched.push(`NAICS ${opp.naics_code}`);
    }
  }

  if (opp.region) {
    const r = opp.region.toLowerCase();
    if (preferredRegions.some(pr => r.includes(pr) || pr.includes(r))) {
      points += num('alignment_region_weight');
      matched.push(`Region: ${opp.region}`);
    }
  }

  if (opp.set_aside) {
    const sa = opp.set_aside.toLowerCase();
    if (certifications.some(c => sa.includes(c))) {
      points += num('alignment_set_aside_weight');
      matched.push(`Set-aside: ${opp.set_aside}`);
    }
  }

  const score = Math.max(1, Math.min(10, Math.round(points)));
  const notes = matched.length ? `Matched: ${matched.join(', ')}` : 'No keyword, NAICS, region, or set-aside matches.';
  return { score, notes };
}

async function scoreOpportunity(opportunityId) {
  const [[opp]] = await db.query(`
    SELECT o.id, o.title, o.description, o.region, gc.naics_code, gc.set_aside
    FROM opportunities o
    LEFT JOIN government_contracts gc ON gc.opportunity_id = o.id
    WHERE o.id = ?
  `, [opportunityId]);
  if (!opp) return null;

  const { score, notes } = await computeAlignmentScore(opp);
  await db.query('UPDATE opportunities SET alignment_score = ?, alignment_notes = ? WHERE id = ?', [score, notes, opportunityId]);
  return score;
}

async function scoreAllUnscored() {
  const [rows] = await db.query('SELECT id FROM opportunities WHERE alignment_score IS NULL');
  for (const row of rows) {
    await scoreOpportunity(row.id);
  }
  return rows.length;
}

// For the manual "Recalculate Scores" control — re-scores every opportunity,
// not just unscored ones, since keyword/weight settings may have changed.
async function rescoreAll() {
  const [rows] = await db.query('SELECT id FROM opportunities');
  for (const row of rows) {
    await scoreOpportunity(row.id);
  }
  return rows.length;
}

module.exports = { computeAlignmentScore, scoreOpportunity, scoreAllUnscored, rescoreAll };
