const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

const FIELDS = [
  'Award ID', 'Recipient Name', 'recipient_id',
  'Start Date', 'End Date', 'Award Amount',
  'Awarding Agency', 'Awarding Sub Agency',
  'Description', 'Place of Performance State Code', 'NAICS Code'
];

router.get('/', async (req, res) => {
  const { q, naics, agency, award_type, year_from, year_to, page: rawPage } = req.query;
  const searched = !!(q || naics || agency);
  let results = null;
  let meta = null;
  let error = null;
  const page = parseInt(rawPage) || 1;

  if (searched) {
    try {
      const type = award_type || 'contracts';

      const CONTRACT_TYPE_CODES = ['A', 'B', 'C', 'D'];
      const GRANT_TYPE_CODES    = ['02', '03', '04', '05'];
      const IDV_TYPE_CODES      = ['E', 'F', 'G', 'H', 'I', 'J', 'K'];

      const awardTypeCodes = type === 'grants' ? GRANT_TYPE_CODES
                           : type === 'idv'    ? IDV_TYPE_CODES
                           : CONTRACT_TYPE_CODES;

      const startYear = parseInt(year_from) || (new Date().getFullYear() - 3);
      const endYear   = parseInt(year_to)   || new Date().getFullYear();

      const filters = {
        award_type_codes: awardTypeCodes,
        time_period: [{ start_date: `${startYear}-01-01`, end_date: `${endYear}-12-31` }]
      };

      if (naics)  filters.naics_codes = [naics];
      if (q)      filters.keywords = [q];
      if (agency) filters.agencies = [{ type: 'awarding', tier: 'toptier', name: agency }];

      const body = { filters, fields: FIELDS, sort: 'Award Amount', order: 'desc', limit: 25, page };

      const resp = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000)
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`USASpending API ${resp.status}: ${txt.slice(0, 300)}`);
      }

      const data = await resp.json();
      meta = data.page_metadata || {};

      results = (data.results || []).map(r => ({
        awardId:      r['Award ID'] || '',
        recipient:    r['Recipient Name'] || '',
        recipientId:  r['recipient_id'] || '',
        startDate:    r['Start Date'] || '',
        endDate:      r['End Date'] || '',
        amount:       r['Award Amount'] || 0,
        agency:       r['Awarding Agency'] || '',
        subAgency:    r['Awarding Sub Agency'] || '',
        description:  r['Description'] || '',
        state:        r['Place of Performance State Code'] || '',
        naicsCode:    r['NAICS Code'] || ''
      }));
    } catch (err) {
      error = err.message;
    }
  }

  const thisYear = new Date().getFullYear();
  res.render('usaspending/index', {
    title: 'USASpending Research',
    results, meta, error, searched,
    filters: {
      q: q || '', naics: naics || '', agency: agency || '',
      award_type: award_type || 'contracts',
      year_from: year_from || String(thisYear - 3),
      year_to:   year_to   || String(thisYear)
    },
    page
  });
});

// Save a past recipient as a teaming partner / institution
router.post('/save-institution', async (req, res) => {
  const { name, state, naics_code, agency } = req.body;
  if (!name) { req.flash('error', 'No name provided.'); return res.redirect('/usaspending'); }

  try {
    const [existing] = await db.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [name]);
    if (existing.length > 0) {
      req.flash('info', `${name} is already in your Institutions list.`);
      return res.redirect(`/institutions/${existing[0].id}`);
    }

    const notes = [
      agency ? `Known contractor for: ${agency}` : '',
      naics_code ? `NAICS: ${naics_code}` : ''
    ].filter(Boolean).join(' | ');

    const [r] = await db.query(`
      INSERT INTO institutions (name, institution_type, relationship_status, state, notes)
      VALUES (?, 'Prime Contractor', 'Prospect', ?, ?)
    `, [name, state || null, notes || null]);

    req.flash('success', `${name} added as a teaming partner / institution.`);
    res.redirect(`/institutions/${r.insertId}`);
  } catch (err) {
    req.flash('error', 'Could not save: ' + err.message);
    res.redirect('/usaspending');
  }
});

module.exports = router;
