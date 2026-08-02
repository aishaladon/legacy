const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

const ELIGIBILITY_LABELS = {
  '00': 'State Governments',
  '01': 'County Governments',
  '02': 'City / Township Governments',
  '04': 'Special District Governments',
  '05': 'Independent School Districts',
  '06': 'Public / State Controlled Institutions of Higher Education',
  '07': 'Native American Tribal Governments',
  '11': 'Small Businesses',
  '12': 'Nonprofits with 501(c)(3)',
  '13': 'Nonprofits without 501(c)(3)',
  '20': 'Private Institutions of Higher Education',
  '21': 'Individuals',
  '22': 'For-Profit Organizations',
  '25': 'Others'
};

router.get('/', async (req, res) => {
  const { q, cfda, agency, eligibility, status: oppStatus, page: rawPage } = req.query;
  const searched = !!(q || cfda || agency);
  let results = null;
  let total = 0;
  let error = null;
  const page = parseInt(rawPage) || 1;
  const rows = 25;
  const startRecord = (page - 1) * rows;

  if (searched) {
    try {
      // The API silently returns zero hits for a comma-separated multi-status
      // value (e.g. "posted,forecasted") — confirmed against the live API it
      // requires pipe-separated instead ("posted|forecasted"). The UI's
      // filter values stay comma-separated (readable in the query string);
      // translate here at the API boundary.
      const body = {
        keyword: q || '',
        oppNum: cfda || '',
        oppStatuses: (oppStatus || 'posted,forecasted').replace(/,/g, '|'),
        rows,
        startRecordNum: startRecord,
        sortBy: 'openDate|desc'
      };

      if (eligibility) body.eligibilities = eligibility;

      const resp = await fetch('https://apply07.grants.gov/grantsws/rest/opportunities/search/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Grants.gov API ${resp.status}: ${txt.slice(0, 300)}`);
      }

      const data = await resp.json();
      // The API returns hitCount/oppHits at the top level (not nested under
      // a "data" key), and cfdaList is an array of plain CFDA number
      // strings (e.g. ["19.040"]), not objects — confirmed against the live
      // API, since the previous mapping read a shape that doesn't exist and
      // silently returned zero results for every search.
      total = data.hitCount || 0;

      results = (data.oppHits || []).map(o => ({
        id:          o.id || '',
        number:      o.number || '',
        title:       o.title || '(untitled)',
        agency:      o.agency || '',
        agencyCode:  o.agencyCode || '',
        openDate:    o.openDate || '',
        closeDate:   o.closeDate || '',
        status:      o.oppStatus || '',
        awardMin:    o.awardFloor   ? parseInt(o.awardFloor)   : null,
        awardMax:    o.awardCeiling ? parseInt(o.awardCeiling) : null,
        cfda:        (o.cfdaList || []).join(', '),
        cfdaTitle:   '',
        grantsUrl:   `https://www.grants.gov/search-results-detail/${o.id}`
      }));
    } catch (err) {
      error = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
    }
  }

  res.render('grants_search/index', {
    title: 'Grants.gov Search',
    results, total, error, searched,
    filters: {
      q: q || '', cfda: cfda || '', agency: agency || '',
      eligibility: eligibility || '', status: oppStatus || 'posted,forecasted'
    },
    eligibilities: ELIGIBILITY_LABELS,
    page, rows
  });
});

// Save a Grants.gov result as a grant opportunity
router.post('/save', async (req, res) => {
  const {
    title, agency, cfda, cfda_title, close_date, open_date,
    award_min, award_max, number, grants_url
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Look up or create funder from agency name
    let funderId = null;
    if (agency) {
      const [existing] = await conn.query('SELECT id FROM funders WHERE name = ? LIMIT 1', [agency]);
      if (existing.length > 0) {
        funderId = existing[0].id;
      } else {
        const [fr] = await conn.query(
          "INSERT INTO funders (name, funder_type) VALUES (?, 'Federal')",
          [agency]
        );
        funderId = fr.insertId;
      }
    }

    const [r] = await conn.query(`
      INSERT INTO opportunities
        (title, opportunity_type, source, source_url, posted_date, due_date,
         amount_min, amount_max, status)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [
      title, 'Grant', 'Grants.gov', grants_url || null,
      open_date || null, close_date || null,
      award_min || null, award_max || null, 'New'
    ]);

    await conn.query(`
      INSERT INTO grant_opportunities (opportunity_id, funder_id, program_name, cfda_number)
      VALUES (?,?,?,?)
    `, [r.insertId, funderId, cfda_title || null, cfda || null]);

    await conn.query(
      'INSERT INTO activity_log (record_type, record_id, action, description) VALUES (?,?,?,?)',
      ['opportunity', r.insertId, 'created', `Imported from Grants.gov: ${title}`]
    );

    await conn.commit();
    req.flash('success', `Grant saved: ${title}`);
    res.redirect(`/opportunities/${r.insertId}`);
  } catch (err) {
    await conn.rollback();
    req.flash('error', 'Could not save: ' + err.message);
    res.redirect('/grants-search');
  } finally {
    conn.release();
  }
});

module.exports = router;
