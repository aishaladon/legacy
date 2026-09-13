const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
  try {
    const [[oppCounts]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'New') AS new_count,
        SUM(status = 'Pursuing') AS pursuing,
        SUM(status = 'Submitted') AS submitted,
        SUM(due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)) AS due_soon
      FROM opportunities
    `);

    const [[pipelineCounts]] = await db.query(`
      SELECT
        COUNT(*) AS in_pipeline,
        SUM(expected_value) AS total_value
      FROM pipeline
      WHERE stage NOT IN ('Awarded','Lost','Withdrawn')
    `);

    const [[projectCounts]] = await db.query(`
      SELECT COUNT(*) AS active_projects
      FROM projects WHERE status = 'Active'
    `);

    const [recentOpps] = await db.query(`
      SELECT id, title, opportunity_type, due_date, alignment_score, status, is_starred
      FROM opportunities
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const [dueSoon] = await db.query(`
      SELECT id, title, opportunity_type, due_date, status
      FROM opportunities
      WHERE due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)
        AND status NOT IN ('Submitted','Awarded','Not Pursuing','Closed')
      ORDER BY due_date ASC
      LIMIT 8
    `);

    res.render('dashboard/index', {
      title: 'Dashboard',
      oppCounts,
      pipelineCounts,
      projectCounts,
      recentOpps,
      dueSoon
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard/index', {
      title: 'Dashboard',
      oppCounts: {},
      pipelineCounts: {},
      projectCounts: {},
      recentOpps: [],
      dueSoon: []
    });
  }
});

module.exports = router;
