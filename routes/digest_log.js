const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const [digests] = await db.query(`
    SELECT id, sent_at, recipient, subject, opportunities_count, status
    FROM daily_digests
    ORDER BY sent_at DESC
    LIMIT 90
  `);
  res.render('digest_log/index', { title: 'Digest Log', digests });
});

router.get('/:id', async (req, res) => {
  const [[digest]] = await db.query('SELECT * FROM daily_digests WHERE id = ?', [req.params.id]);
  if (!digest) { req.flash('error', 'Not found.'); return res.redirect('/digest-log'); }
  res.render('digest_log/detail', { title: `Digest — ${digest.sent_at}`, digest });
});

module.exports = router;
