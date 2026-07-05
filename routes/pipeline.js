const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

const STAGES = [
  'Identified','Qualified','Pursuing','Proposal In Progress',
  'Submitted','Negotiating','Awarded','Lost','Withdrawn'
];

router.get('/', async (req, res) => {
  const { stage } = req.query;
  let where = ['p.stage NOT IN (?)'];
  const params = [['Awarded','Lost','Withdrawn']];

  if (stage) { where = ['p.stage = ?']; params.splice(0, 1, stage); }

  const [items] = await db.query(`
    SELECT p.*, o.title, o.due_date, o.opportunity_type, o.amount_min, o.amount_max, o.alignment_score
    FROM pipeline p
    JOIN opportunities o ON p.opportunity_id = o.id
    WHERE ${where.join(' AND ')}
    ORDER BY p.next_action_date ASC, o.due_date ASC
  `, params);

  const [[totals]] = await db.query(`
    SELECT COUNT(*) AS count, SUM(expected_value) AS total_value
    FROM pipeline WHERE stage NOT IN ('Awarded','Lost','Withdrawn')
  `);

  res.render('pipeline/index', {
    title: 'Pipeline',
    items,
    totals,
    stages: STAGES,
    filters: { stage }
  });
});

router.get('/add/:opportunity_id', async (req, res) => {
  const [[opp]] = await db.query('SELECT id, title FROM opportunities WHERE id = ?', [req.params.opportunity_id]);
  if (!opp) { req.flash('error', 'Opportunity not found.'); return res.redirect('/opportunities'); }
  res.render('pipeline/form', { title: 'Add to Pipeline', opp, item: null, stages: STAGES });
});

router.post('/', async (req, res) => {
  const { opportunity_id, stage, probability, expected_value, go_no_go_notes, next_action, next_action_date } = req.body;
  await db.query(`
    INSERT INTO pipeline (opportunity_id, stage, probability, expected_value, go_no_go_notes, next_action, next_action_date)
    VALUES (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE stage=VALUES(stage), probability=VALUES(probability),
      expected_value=VALUES(expected_value), go_no_go_notes=VALUES(go_no_go_notes),
      next_action=VALUES(next_action), next_action_date=VALUES(next_action_date)
  `, [opportunity_id, stage, probability || null, expected_value || null,
      go_no_go_notes || null, next_action || null, next_action_date || null]);

  req.flash('success', 'Pipeline updated.');
  res.redirect('/pipeline');
});

router.get('/:id/edit', async (req, res) => {
  const [[item]] = await db.query(`
    SELECT p.*, o.title FROM pipeline p JOIN opportunities o ON p.opportunity_id = o.id WHERE p.id = ?
  `, [req.params.id]);
  if (!item) { req.flash('error', 'Not found.'); return res.redirect('/pipeline'); }
  res.render('pipeline/form', { title: 'Update Pipeline', opp: { id: item.opportunity_id, title: item.title }, item, stages: STAGES });
});

router.post('/:id/edit', async (req, res) => {
  const { stage, probability, expected_value, go_no_go_notes, next_action, next_action_date } = req.body;
  await db.query(`
    UPDATE pipeline SET stage=?, probability=?, expected_value=?, go_no_go_notes=?, next_action=?, next_action_date=?
    WHERE id=?
  `, [stage, probability || null, expected_value || null,
      go_no_go_notes || null, next_action || null, next_action_date || null, req.params.id]);

  req.flash('success', 'Pipeline updated.');
  res.redirect('/pipeline');
});

module.exports = router;
