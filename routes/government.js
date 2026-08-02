const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { status, set_aside, q } = req.query;
  let where = ['o.opportunity_type = ?'];
  const params = ['Government Contract'];

  if (status) { where.push('o.status = ?'); params.push(status); }
  if (set_aside) { where.push('gc.set_aside = ?'); params.push(set_aside); }
  if (q) {
    // Search title, solicitation #, agency, and NAICS code — a title-only
    // search made "no results" the common outcome for a term that's
    // genuinely on the record but not literally in the title.
    where.push('(o.title LIKE ? OR o.description LIKE ? OR gc.solicitation_number LIKE ? OR gc.agency LIKE ? OR gc.sub_agency LIKE ? OR gc.naics_code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const [contracts] = await db.query(`
    SELECT o.id, o.title, o.due_date, o.amount_min, o.amount_max, o.status,
           o.alignment_score, o.is_starred, o.region,
           gc.solicitation_number, gc.agency, gc.set_aside, gc.naics_code
    FROM opportunities o
    LEFT JOIN government_contracts gc ON gc.opportunity_id = o.id
    WHERE ${where.join(' AND ')}
    ORDER BY o.is_starred DESC, o.due_date ASC
    LIMIT 100
  `, params);

  res.render('government/index', {
    title: 'Government Contracts',
    contracts,
    filters: { status, set_aside, q }
  });
});

router.get('/new', (req, res) => {
  res.render('government/form', { title: 'Add Government Contract', opp: null, gov: null });
});

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      title, source_url, posted_date, due_date, amount_min, amount_max,
      description, region, status,
      solicitation_number, agency, sub_agency, naics_code, set_aside,
      contract_type, place_of_performance, sam_notice_id
    } = req.body;

    const [r] = await conn.query(`
      INSERT INTO opportunities
        (title, opportunity_type, source, source_url, posted_date, due_date,
         amount_min, amount_max, description, region, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, [title, 'Government Contract', 'Manual', source_url || null,
        posted_date || null, due_date || null,
        amount_min || null, amount_max || null,
        description || null, region || null, status || 'New']);

    await conn.query(`
      INSERT INTO government_contracts
        (opportunity_id, solicitation_number, agency, sub_agency, naics_code,
         set_aside, contract_type, place_of_performance, sam_notice_id)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [r.insertId, solicitation_number || null, agency || null,
        sub_agency || null, naics_code || null, set_aside || null,
        contract_type || null, place_of_performance || null, sam_notice_id || null]);

    await conn.commit();
    req.flash('success', 'Contract added.');
    res.redirect(`/opportunities/${r.insertId}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
