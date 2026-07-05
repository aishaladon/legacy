const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { status } = req.query;
  let where = ['1=1'];
  const params = [];
  if (status) { where.push('p.status = ?'); params.push(status); }

  const [projects] = await db.query(`
    SELECT p.*, i.name AS institution_name
    FROM projects p
    LEFT JOIN institutions i ON p.institution_id = i.id
    WHERE ${where.join(' AND ')}
    ORDER BY p.status ASC, p.end_date ASC
  `, params);

  res.render('projects/index', { title: 'Projects', projects, filters: { status } });
});

router.get('/new', async (req, res) => {
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('projects/form', { title: 'Add Project', project: null, institutions });
});

router.post('/', async (req, res) => {
  const {
    title, project_type, status, start_date, end_date,
    contract_value, contract_number, institution_id, co_pi, deliverables_notes, notes
  } = req.body;

  const [r] = await db.query(`
    INSERT INTO projects
      (title, project_type, status, start_date, end_date,
       contract_value, contract_number, institution_id, co_pi, deliverables_notes, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `, [title, project_type, status || 'Active',
      start_date || null, end_date || null,
      contract_value || null, contract_number || null,
      institution_id || null, co_pi || null,
      deliverables_notes || null, notes || null]);

  req.flash('success', 'Project added.');
  res.redirect(`/projects/${r.insertId}`);
});

router.get('/:id', async (req, res) => {
  const [[project]] = await db.query(`
    SELECT p.*, i.name AS institution_name
    FROM projects p LEFT JOIN institutions i ON p.institution_id = i.id
    WHERE p.id = ?
  `, [req.params.id]);
  if (!project) { req.flash('error', 'Not found.'); return res.redirect('/projects'); }
  res.render('projects/detail', { title: project.title, project });
});

router.get('/:id/edit', async (req, res) => {
  const [[project]] = await db.query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) { req.flash('error', 'Not found.'); return res.redirect('/projects'); }
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('projects/form', { title: 'Edit Project', project, institutions });
});

router.post('/:id/edit', async (req, res) => {
  const {
    title, project_type, status, start_date, end_date,
    contract_value, contract_number, institution_id, co_pi, deliverables_notes, notes
  } = req.body;

  await db.query(`
    UPDATE projects SET title=?, project_type=?, status=?, start_date=?, end_date=?,
      contract_value=?, contract_number=?, institution_id=?, co_pi=?, deliverables_notes=?, notes=?
    WHERE id=?
  `, [title, project_type, status, start_date || null, end_date || null,
      contract_value || null, contract_number || null,
      institution_id || null, co_pi || null,
      deliverables_notes || null, notes || null, req.params.id]);

  req.flash('success', 'Project updated.');
  res.redirect(`/projects/${req.params.id}`);
});

module.exports = router;
