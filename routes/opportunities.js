const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { type, status, q } = req.query;
  let where = ['1=1'];
  const params = [];

  if (type) { where.push('o.opportunity_type = ?'); params.push(type); }
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (q) { where.push('o.title LIKE ?'); params.push(`%${q}%`); }

  const [opportunities] = await db.query(`
    SELECT o.*, i.name AS institution_name
    FROM opportunities o
    LEFT JOIN institutions i ON o.institution_id = i.id
    WHERE ${where.join(' AND ')}
    ORDER BY o.is_starred DESC, o.due_date ASC, o.created_at DESC
    LIMIT 100
  `, params);

  res.render('opportunities/index', {
    title: 'All Opportunities',
    opportunities,
    filters: { type, status, q }
  });
});

router.get('/new', async (req, res) => {
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('opportunities/form', { title: 'Add Opportunity', opportunity: null, institutions });
});

router.get('/evaluate', (req, res) => {
  res.render('opportunities/evaluate', { title: 'Evaluate Opportunity with AI' });
});

router.post('/evaluate-api', async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide opportunity details.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Claude API key not configured. Contact your administrator.' });
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an expert business development evaluator for Legacy Planning & Preservation Ltd., a company that pursues government contracts and grants.

Evaluate this opportunity and respond ONLY with valid JSON (no markdown, no code blocks, just raw JSON):

{
  "fit_score": <1-10>,
  "reasoning": "<2-3 sentence explanation of the score>",
  "opportunity_type": "<Contract or Grant>",
  "region": "<region if mentioned, otherwise null>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"],
  "recommendation": "<Add to System or Skip>"
}

OPPORTUNITY TEXT:
${text}`
        }
      ]
    });

    const content = response.content[0].text.trim();
    let evaluation;

    try {
      evaluation = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ error: 'Could not parse Claude response. Please try again.' });
    }

    res.json(evaluation);
  } catch (err) {
    console.error('Claude API error:', err);
    if (err.status === 401) {
      return res.status(500).json({ error: 'Invalid Claude API key.' });
    }
    res.status(500).json({ error: 'Evaluation failed. Please try again.' });
  }
});

router.post('/', async (req, res) => {
  const {
    title, opportunity_type, source, source_url, posted_date, due_date,
    amount_min, amount_max, description, region, status, is_starred, institution_id
  } = req.body;

  const [result] = await db.query(`
    INSERT INTO opportunities
      (title, opportunity_type, source, source_url, posted_date, due_date,
       amount_min, amount_max, description, region, status, is_starred, institution_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    title, opportunity_type, source || null, source_url || null,
    posted_date || null, due_date || null,
    amount_min || null, amount_max || null,
    description || null, region || null,
    status || 'New', is_starred ? 1 : 0, institution_id || null
  ]);

  await db.query(
    'INSERT INTO activity_log (record_type, record_id, action, description) VALUES (?,?,?,?)',
    ['opportunity', result.insertId, 'created', `Created: ${title}`]
  );

  req.flash('success', 'Opportunity added.');
  res.redirect(`/opportunities/${result.insertId}`);
});

router.get('/:id', async (req, res) => {
  const [[opp]] = await db.query(`
    SELECT o.*, i.name AS institution_name, c.first_name, c.last_name
    FROM opportunities o
    LEFT JOIN institutions i ON o.institution_id = i.id
    LEFT JOIN contacts c ON o.contact_id = c.id
    WHERE o.id = ?
  `, [req.params.id]);

  if (!opp) { req.flash('error', 'Opportunity not found.'); return res.redirect('/opportunities'); }

  const [[govContract]] = await db.query('SELECT * FROM government_contracts WHERE opportunity_id = ?', [opp.id]);
  const [[grantOpp]] = await db.query(`
    SELECT go.*, f.name AS funder_name
    FROM grant_opportunities go
    LEFT JOIN funders f ON go.funder_id = f.id
    WHERE go.opportunity_id = ?
  `, [opp.id]);
  const [[pipeline]] = await db.query('SELECT * FROM pipeline WHERE opportunity_id = ?', [opp.id]);
  const [activity] = await db.query(
    'SELECT * FROM activity_log WHERE record_type = ? AND record_id = ? ORDER BY created_at DESC LIMIT 20',
    ['opportunity', opp.id]
  );

  res.render('opportunities/detail', {
    title: opp.title,
    opp, govContract, grantOpp, pipeline, activity
  });
});

router.get('/:id/edit', async (req, res) => {
  const [[opportunity]] = await db.query('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
  if (!opportunity) { req.flash('error', 'Not found.'); return res.redirect('/opportunities'); }
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('opportunities/form', { title: 'Edit Opportunity', opportunity, institutions });
});

router.post('/:id/edit', async (req, res) => {
  const {
    title, opportunity_type, source, source_url, posted_date, due_date,
    amount_min, amount_max, description, region, status, is_starred, institution_id
  } = req.body;

  await db.query(`
    UPDATE opportunities SET
      title=?, opportunity_type=?, source=?, source_url=?, posted_date=?,
      due_date=?, amount_min=?, amount_max=?, description=?, region=?,
      status=?, is_starred=?, institution_id=?
    WHERE id=?
  `, [
    title, opportunity_type, source || null, source_url || null,
    posted_date || null, due_date || null,
    amount_min || null, amount_max || null,
    description || null, region || null,
    status, is_starred ? 1 : 0, institution_id || null,
    req.params.id
  ]);

  req.flash('success', 'Opportunity updated.');
  res.redirect(`/opportunities/${req.params.id}`);
});

router.post('/:id/star', async (req, res) => {
  const [[opp]] = await db.query('SELECT is_starred FROM opportunities WHERE id = ?', [req.params.id]);
  if (opp) {
    await db.query('UPDATE opportunities SET is_starred = ? WHERE id = ?', [opp.is_starred ? 0 : 1, req.params.id]);
  }
  res.redirect('back');
});

router.post('/:id/delete', async (req, res) => {
  await db.query('DELETE FROM opportunities WHERE id = ?', [req.params.id]);
  req.flash('success', 'Opportunity deleted.');
  res.redirect('/opportunities');
});

module.exports = router;
