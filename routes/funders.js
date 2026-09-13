const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { type, q } = req.query;
  let where = ['is_active = 1'];
  const params = [];
  if (type) { where.push('funder_type = ?'); params.push(type); }
  if (q) { where.push('name LIKE ?'); params.push(`%${q}%`); }

  const [funders] = await db.query(
    `SELECT * FROM funders WHERE ${where.join(' AND ')} ORDER BY funder_type, name`,
    params
  );
  res.render('funders/index', { title: 'Funders', funders, filters: { type, q } });
});

router.get('/new', (req, res) => {
  res.render('funders/form', { title: 'Add Funder', funder: null });
});

router.post('/', async (req, res) => {
  const { name, funder_type, website, eligible_institution_types, notes } = req.body;
  const [r] = await db.query(`
    INSERT INTO funders (name, funder_type, website, eligible_institution_types, notes)
    VALUES (?,?,?,?,?)
  `, [name, funder_type, website || null, eligible_institution_types || null, notes || null]);
  req.flash('success', 'Funder added.');
  res.redirect(`/funders/${r.insertId}`);
});

router.get('/:id', async (req, res) => {
  const [[funder]] = await db.query('SELECT * FROM funders WHERE id = ?', [req.params.id]);
  if (!funder) { req.flash('error', 'Not found.'); return res.redirect('/funders'); }
  const [grants] = await db.query(`
    SELECT o.id, o.title, o.due_date, o.status, o.amount_min, o.amount_max
    FROM grant_opportunities go
    JOIN opportunities o ON go.opportunity_id = o.id
    WHERE go.funder_id = ? ORDER BY o.due_date DESC
  `, [req.params.id]);
  res.render('funders/detail', { title: funder.name, funder, grants });
});

router.get('/:id/edit', async (req, res) => {
  const [[funder]] = await db.query('SELECT * FROM funders WHERE id = ?', [req.params.id]);
  if (!funder) { req.flash('error', 'Not found.'); return res.redirect('/funders'); }
  res.render('funders/form', { title: 'Edit Funder', funder });
});

router.post('/:id/edit', async (req, res) => {
  const { name, funder_type, website, eligible_institution_types, notes } = req.body;
  await db.query(`
    UPDATE funders SET name=?, funder_type=?, website=?, eligible_institution_types=?, notes=? WHERE id=?
  `, [name, funder_type, website || null, eligible_institution_types || null, notes || null, req.params.id]);
  req.flash('success', 'Funder updated.');
  res.redirect(`/funders/${req.params.id}`);
});

router.post('/:id/delete', async (req, res) => {
  await db.query('UPDATE funders SET is_active = 0 WHERE id = ?', [req.params.id]);
  req.flash('success', 'Funder deleted.');
  res.redirect('/funders');
});

// CSV import
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import-csv', upload.single('csv_file'), async (req, res) => {
  const { parse } = require('csv-parse/sync');
  const csvText = (req.file && req.file.buffer.length > 0)
    ? req.file.buffer.toString('utf8').trim()
    : (req.body.csv_data || '').trim();

  if (!csvText) {
    req.flash('error', 'No CSV data provided — upload a file or paste CSV text.');
    return res.redirect('/funders#import');
  }

  let records;
  try {
    records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  } catch (err) {
    req.flash('error', 'Could not parse CSV: ' + err.message);
    return res.redirect('/funders#import');
  }

  if (!records.length) {
    req.flash('error', 'CSV contained no data rows.');
    return res.redirect('/funders#import');
  }

  let added = 0, skipped = 0, errors = 0;
  for (const row of records) {
    const name = (row.name || row.Name || '').trim();
    if (!name) { skipped++; continue; }

    const funder_type              = (row.funder_type              || row['Funder Type']              || row.type || row.Type || 'Foundation').trim();
    const website                  = (row.website                  || row.Website                  || '').trim() || null;
    const eligible_institution_types = (row.eligible_institution_types || row['Eligible Institution Types'] || row.eligible || '').trim() || null;
    const notes                    = (row.notes                    || row.Notes                    || '').trim() || null;

    try {
      const [existing] = await db.query('SELECT id FROM funders WHERE name = ? LIMIT 1', [name]);
      if (existing.length > 0) { skipped++; continue; }
      await db.query(`
        INSERT INTO funders (name, funder_type, website, eligible_institution_types, notes)
        VALUES (?,?,?,?,?)
      `, [name, funder_type, website, eligible_institution_types, notes]);
      added++;
    } catch (_) {
      errors++;
    }
  }

  const msg = `Funders imported: ${added} added, ${skipped} skipped (already exist or blank)${errors ? ', ' + errors + ' errors' : ''}.`;
  req.flash('success', msg);
  res.redirect('/funders');
});

module.exports = router;
