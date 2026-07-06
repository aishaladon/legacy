const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

const FIELDS = [
  'Award ID', 'Recipient Name',
  'Start Date', 'End Date', 'Award Amount',
  'Awarding Sub Agency', 'Description',
  'Place of Performance State Code', 'Place of Performance City Name'
];

const SUB_AGENCY_FILTERS = {
  '':        'All IMLS Programs',
  'museum':  'Museum Services',
  'library': 'Library Services'
};

router.get('/', async (req, res) => {
  const { q, state, year_from, year_to, sub, page: rawPage } = req.query;
  const thisYear = new Date().getFullYear();

  let results = null;
  let meta = {};
  let error = null;
  const page = parseInt(rawPage) || 1;

  try {
    const startYear = parseInt(year_from) || (thisYear - 4);
    const endYear   = parseInt(year_to)   || thisYear;

    const filters = {
      award_type_codes: ['02', '03', '04', '05', '06'],
      time_period: [{ start_date: `${startYear}-01-01`, end_date: `${endYear}-12-31` }]
    };

    // Default: filter to IMLS toptier agency
    filters.agencies = [{ type: 'awarding', tier: 'toptier', name: 'Institute of Museum and Library Services' }];

    if (sub === 'museum') {
      filters.agencies = [{ type: 'awarding', tier: 'subtier', name: 'Office of Museum Services' }];
    } else if (sub === 'library') {
      filters.agencies = [{ type: 'awarding', tier: 'subtier', name: 'Office of Library Services' }];
    }

    if (q)     filters.keywords = [q];
    if (state) filters.place_of_performance_locations = [{ country: 'USA', state: state.toUpperCase() }];

    const body = {
      filters, fields: FIELDS,
      sort: 'Award Amount', order: 'desc',
      limit: 25, page
    };

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
      awardId:     r['Award ID']     || '',
      recipient:   r['Recipient Name'] || '',
      startDate:   r['Start Date']   || '',
      endDate:     r['End Date']     || '',
      amount:      r['Award Amount'] || 0,
      subAgency:   r['Awarding Sub Agency'] || '',
      description: r['Description'] || '',
      state:       r['Place of Performance State Code'] || '',
      city:        r['Place of Performance City Name'] || ''
    }));
  } catch (err) {
    error = err.message;
  }

  res.render('imls/index', {
    title: 'IMLS Award Search',
    results, meta, error,
    filters: {
      q: q || '', state: state || '',
      year_from: year_from || String(thisYear - 4),
      year_to:   year_to   || String(thisYear),
      sub: sub || ''
    },
    subAgencies: SUB_AGENCY_FILTERS,
    page
  });
});

// Save a past IMLS recipient as a target institution
router.post('/save-institution', async (req, res) => {
  const { name, city, state, sub_agency, description } = req.body;
  if (!name) { req.flash('error', 'No name provided.'); return res.redirect('/imls'); }

  try {
    const [existing] = await db.query('SELECT id FROM institutions WHERE name = ? LIMIT 1', [name]);
    if (existing.length > 0) {
      req.flash('info', `${name} is already in your Institutions list.`);
      return res.redirect(`/institutions/${existing[0].id}`);
    }

    const instType = (sub_agency || '').toLowerCase().includes('museum') ? 'Museum' : 'Library';
    const notes = [
      'IMLS grant recipient.',
      sub_agency ? `Program: ${sub_agency}.` : '',
      description ? description.slice(0, 200) : ''
    ].filter(Boolean).join(' ');

    const [r] = await db.query(`
      INSERT INTO institutions (name, institution_type, relationship_status, city, state, notes)
      VALUES (?, ?, 'Target', ?, ?, ?)
    `, [name, instType, city || null, state || null, notes || null]);

    req.flash('success', `${name} added as a target institution.`);
    res.redirect(`/institutions/${r.insertId}`);
  } catch (err) {
    req.flash('error', 'Could not save: ' + err.message);
    res.redirect('/imls');
  }
});

module.exports = router;
