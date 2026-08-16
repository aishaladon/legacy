const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const { getClaudeApiKey } = require('../utils/claudeApiKey');
const { extractResponseText } = require('../utils/claudeResponseText');
const { scoreOpportunity } = require('../services/alignmentScorer');
const { getCompanyProfile } = require('../utils/companyProfile');

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { type, status, q, due_within } = req.query;
  let where = ['1=1'];
  const params = [];

  if (type) { where.push('o.opportunity_type = ?'); params.push(type); }
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (due_within) {
    // Matches the Dashboard's "Due in 14 Days" tile count exactly —
    // due_date within N days from today, no status filter.
    where.push('o.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)');
    params.push(parseInt(due_within, 10) || 14);
  }
  if (q) {
    // Search title, description, source, and (for government contracts)
    // agency and NAICS code — a title-only search made "no results" the
    // common outcome for a term that's genuinely on the record but just
    // not literally in the title.
    where.push('(o.title LIKE ? OR o.description LIKE ? OR o.source LIKE ? OR gc.agency LIKE ? OR gc.naics_code LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const [opportunities] = await db.query(`
    SELECT o.*, i.name AS institution_name, gc.naics_code, gc.agency AS gc_agency
    FROM opportunities o
    LEFT JOIN institutions i ON o.institution_id = i.id
    LEFT JOIN government_contracts gc ON gc.opportunity_id = o.id
    WHERE ${where.join(' AND ')}
    ORDER BY o.is_starred DESC, o.due_date ASC, o.created_at DESC
    LIMIT 100
  `, params);

  res.render('opportunities/index', {
    title: due_within ? `Due in ${due_within} Days` : 'All Opportunities',
    opportunities,
    filters: { type, status, q }
  });
});

router.get('/new', async (req, res) => {
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('opportunities/form', { title: 'Add Opportunity', opportunity: null, institutions });
});

router.get('/evaluate', async (req, res) => {
  const [institutions] = await db.query('SELECT id, name FROM institutions WHERE is_active=1 ORDER BY name');
  res.render('opportunities/evaluate', { title: 'Evaluate Opportunity with AI', institutions });
});

router.get('/:id/draft-proposal', async (req, res) => {
  const [[opp]] = await db.query('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
  if (!opp) { req.flash('error', 'Opportunity not found.'); return res.redirect('/opportunities'); }

  res.render('opportunities/draft-proposal', { title: 'Draft RFP Response', opp });
});

router.post('/:id/draft-proposal-api', async (req, res) => {
  const [[opp]] = await db.query('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
  if (!opp) return res.status(404).json({ error: 'Opportunity not found.' });

  const apiKey = await getClaudeApiKey();
  if (!apiKey) return res.status(500).json({ error: 'Claude API key not set. Go to Settings → API Keys to add it.' });

  const company = await getCompanyProfile();

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `You are drafting a professional RFP response for a government contracting opportunity.

COMPANY INFO:
Name: ${company.name}
NAICS Codes: ${company.naicsSummary}
Certifications: ${company.certifications || '(not specified)'}

CAPABILITY STATEMENT / BOILERPLATE:
${company.capabilityStatement}

OPPORTUNITY:
Title: ${opp.title}
Type: ${opp.opportunity_type}
Description: ${opp.description || ''}
Requirements: ${opp.requirements || '(not specified)'}

Draft a professional RFP response that:
1. Shows understanding of the opportunity and requirements
2. Demonstrates how our company capabilities align with the needs
3. Is compelling and professional
4. Includes sections: Executive Summary, Approach/Methodology, Company Qualifications, Team, Timeline, and Pricing Strategy (if applicable)
5. Use business-appropriate tone, no markdown formatting

Generate the response as plain text with clear section headers.`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    const draft = extractResponseText(response);
    res.json({ draft });
  } catch (err) {
    console.error('Claude API error:', err);
    let errorMsg = 'Draft generation failed. Please try again.';
    if (err.status === 401) {
      errorMsg = 'Invalid Claude API key — check it in Settings → API Keys.';
    } else if (err.status === 429) {
      errorMsg = 'Rate limited — too many requests. Wait a moment and try again.';
    }
    res.status(500).json({ error: errorMsg });
  }
});

router.post('/:id/download-proposal', async (req, res) => {
  const { title, draft } = req.body;

  try {
    const sections = [];
    const lines = draft.split('\n');

    lines.forEach(line => {
      if (line.trim()) {
        // Check if line looks like a heading (all caps, short)
        if (line.match(/^[A-Z][A-Z\s]+:?$/) && line.length < 60) {
          sections.push(new Paragraph({
            text: line.trim(),
            heading: HeadingLevel.HEADING_1,
            thematicBreak: false
          }));
        } else {
          sections.push(new Paragraph({
            text: line,
            spacing: { line: 360 }
          }));
        }
      } else {
        sections.push(new Paragraph('')); // Empty line for spacing
      }
    });

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: title || 'RFP Response',
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `Generated on ${new Date().toLocaleDateString()}`,
            spacing: { after: 600 }
          }),
          ...sections
        ]
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="RFP_Response_${req.params.id}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('Document generation error:', err);
    res.status(500).json({ error: 'Could not generate document.' });
  }
});

router.post('/evaluate-api', async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide opportunity details.' });
  }

  const apiKey = await getClaudeApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'Claude API key not set. Go to Settings → API Keys to add it.' });
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

    const content = extractResponseText(response).trim();
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

  if (!title || !title.trim()) {
    req.flash('error', 'Title is required.');
    return res.redirect('/opportunities/new');
  }

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

  await scoreOpportunity(result.insertId).catch(() => {});

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

  if (!title || !title.trim()) {
    req.flash('error', 'Title is required.');
    return res.redirect(`/opportunities/${req.params.id}/edit`);
  }

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

  await scoreOpportunity(req.params.id).catch(() => {});

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

router.post('/bulk-delete', async (req, res) => {
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = ids.map(id => parseInt(id, 10)).filter(Number.isInteger);

  if (ids.length === 0) {
    req.flash('error', 'No opportunities selected.');
    return res.redirect('/opportunities');
  }

  await db.query('DELETE FROM opportunities WHERE id IN (?)', [ids]);
  req.flash('success', `${ids.length} opportunity(ies) deleted.`);
  res.redirect('/opportunities');
});

module.exports = router;
