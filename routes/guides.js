const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const [guides] = await db.query(
    'SELECT * FROM bid_writing_guides ORDER BY sort_order, opportunity_type, title'
  );
  res.render('guides/index', { title: 'Bid Writing Guides', guides });
});

router.get('/new', (req, res) => {
  res.render('guides/form', { title: 'New Guide', guide: null });
});

router.post('/', async (req, res) => {
  const { title, opportunity_type, content, is_template, sort_order } = req.body;
  const [r] = await db.query(`
    INSERT INTO bid_writing_guides (title, opportunity_type, content, is_template, sort_order)
    VALUES (?,?,?,?,?)
  `, [title, opportunity_type, content, is_template ? 1 : 0, sort_order || 0]);
  req.flash('success', 'Guide saved.');
  res.redirect(`/guides/${r.insertId}`);
});

router.get('/:id', async (req, res) => {
  const [[guide]] = await db.query('SELECT * FROM bid_writing_guides WHERE id = ?', [req.params.id]);
  if (!guide) { req.flash('error', 'Not found.'); return res.redirect('/guides'); }
  res.render('guides/detail', { title: guide.title, guide });
});

router.get('/:id/edit', async (req, res) => {
  const [[guide]] = await db.query('SELECT * FROM bid_writing_guides WHERE id = ?', [req.params.id]);
  if (!guide) { req.flash('error', 'Not found.'); return res.redirect('/guides'); }
  res.render('guides/form', { title: 'Edit Guide', guide });
});

router.post('/:id/edit', async (req, res) => {
  const { title, opportunity_type, content, is_template, sort_order } = req.body;
  await db.query(`
    UPDATE bid_writing_guides SET title=?, opportunity_type=?, content=?, is_template=?, sort_order=? WHERE id=?
  `, [title, opportunity_type, content, is_template ? 1 : 0, sort_order || 0, req.params.id]);
  req.flash('success', 'Guide updated.');
  res.redirect(`/guides/${req.params.id}`);
});

router.post('/:id/delete', async (req, res) => {
  await db.query('DELETE FROM bid_writing_guides WHERE id = ?', [req.params.id]);
  req.flash('success', 'Guide deleted.');
  res.redirect('/guides');
});

module.exports = router;
