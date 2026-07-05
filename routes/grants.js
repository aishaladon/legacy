const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { status, funder_id, q } = req.query;
  let where = ["o.opportunity_type = 'Grant'"];
  const params = [];

  if (status) { where.push('o.status = ?'); params.push(status); }
  if (funder_id) { where.push('go.funder_id = ?'); params.push(funder_id); }
  if (q) { where.push('o.title LIKE ?'); params.push(`%${q}%`); }

  const [grants] = await db.query(`
    SELECT o.id, o.title, o.due_date, o.amount_min, o.amount_max, o.status,
           o.alignment_score, o.is_starred, o.region,
           f.name AS funder_name, go.program_name, go.match_required
    FROM opportunities o
    LEFT JOIN grant_opportunities go ON go.opportunity_id = o.id
    LEFT JOIN funders f ON go.funder_id = f.id
    WHERE ${where.join(' AND ')}
    ORDER BY o.is_starred DESC, o.due_date ASC
    LIMIT 100
  `, params);

  const [funders] = await db.query('SELECT id, name FROM funders WHERE is_active = 1 ORDER BY name');

  res.render('grants/index', {
    title: 'Grant Opportunities',
    grants,
    funders,
    filters: { status, funder_id, q }
  });
});

router.get('/new', async (req, res) => {
  const [funders] = await db.query('SELECT id, name FROM funders WHERE is_active = 1 ORDER BY name');
  res.render('grants/form', { title: 'Add Grant Opportunity', opp: null, grant: null, funders });
});

router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      title, source_url, posted_date, due_date, amount_min, amount_max,
      description, region, status,
      funder_id, grant_number, program_name, eligible_applicants,
      match_required, match_percentage, application_portal
    } = req.body;

    const [r] = await conn.query(`
      INSERT INTO opportunities
        (title, opportunity_type, source, source_url, posted_date, due_date,
         amount_min, amount_max, description, region, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, [title, 'Grant', 'Manual', source_url || null,
        posted_date || null, due_date || null,
        amount_min || null, amount_max || null,
        description || null, region || null, status || 'New']);

    await conn.query(`
      INSERT INTO grant_opportunities
        (opportunity_id, funder_id, grant_number, program_name,
         eligible_applicants, match_required, match_percentage, application_portal)
      VALUES (?,?,?,?,?,?,?,?)
    `, [r.insertId, funder_id || null, grant_number || null, program_name || null,
        eligible_applicants || null, match_required ? 1 : 0,
        match_percentage || null, application_portal || null]);

    await conn.commit();
    req.flash('success', 'Grant opportunity added.');
    res.redirect(`/opportunities/${r.insertId}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

module.exports = router;
