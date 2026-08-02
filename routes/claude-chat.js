const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const MAX_HISTORY_MESSAGES = 20;
const MAX_ATTACHMENT_CHARS = 15000;

router.get('/api/claude-test', async (req, res) => {
  try {
    const [[apiKeyRow]] = await db.query("SELECT value FROM user_settings WHERE name='claude_api_key'");
    const apiKey = apiKeyRow ? apiKeyRow.value : null;

    if (!apiKey) {
      return res.json({ status: 'error', message: 'No API key found in database' });
    }

    const keyStart = apiKey.substring(0, 10);
    const keyEnd = apiKey.substring(apiKey.length - 4);
    const masked = `${keyStart}...${keyEnd} (length: ${apiKey.length})`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Say hello' }]
    });

    res.json({
      status: 'success',
      message: 'Claude API is working!',
      apiKey: masked,
      response: response.content[0].text
    });
  } catch (err) {
    res.json({
      status: 'error',
      message: err.message,
      error: err.error || err,
      status_code: err.status
    });
  }
});

// Extracts plain text from an uploaded attachment. Only .txt and .pdf are
// supported — there's no docx-reading library in this project (the "docx"
// dependency only writes .docx, it doesn't parse them).
async function extractAttachmentText(file) {
  const name = file.originalname || 'attachment';
  const ext = (name.split('.').pop() || '').toLowerCase();

  let text;
  if (ext === 'pdf' || file.mimetype === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(file.buffer);
    text = parsed.text;
  } else if (ext === 'txt' || file.mimetype === 'text/plain') {
    text = file.buffer.toString('utf8');
  } else {
    throw new Error(`Unsupported file type "${ext || file.mimetype}" — only .txt and .pdf are supported.`);
  }

  text = (text || '').trim();
  const truncated = text.length > MAX_ATTACHMENT_CHARS;
  if (truncated) text = text.slice(0, MAX_ATTACHMENT_CHARS) + '\n\n[...attachment truncated...]';

  return `[Attached file: ${name}]\n\n${text || '(no extractable text found in this file)'}`;
}

// Conversation history is sent by the client (persisted in its own
// localStorage, since this is a static multi-page app with no server-side
// session store for chat) as a JSON string of {role, content} turns. Only
// well-formed user/assistant turns are trusted; anything else is dropped
// rather than passed to the API.
function parseHistory(raw) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({ role: m.role, content: m.content }));
}

router.post('/claude-chat', requireLogin, upload.single('file'), async (req, res) => {
  const message = (req.body.message || '').trim();
  if (!message && !req.file) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const [[apiKeyRow]] = await db.query("SELECT value FROM user_settings WHERE name='claude_api_key'");
  const apiKey = apiKeyRow ? apiKeyRow.value : null;

  if (!apiKey) {
    return res.status(500).json({ error: 'Claude API key not set. Go to Settings → API Keys to add it.' });
  }

  try {
    let userContent = message;
    if (req.file) {
      const attachmentText = await extractAttachmentText(req.file);
      userContent = message ? `${attachmentText}\n\n---\n\nUser's message: ${message}` : attachmentText;
    }

    const client = new Anthropic({ apiKey });

    // Pull real company context — these three sources are where the data
    // actually lives (a previous version of this prompt queried user_settings
    // for company_name/company_naics_codes/company_capabilities/
    // company_background, none of which exist as setting names, so Claude
    // was always told "(not specified)" regardless of what was configured).
    let companyInfo = {};
    try {
      const [settings] = await db.query(
        "SELECT name, value FROM user_settings WHERE name IN ('company_cage', 'company_uei', 'company_certifications')"
      );
      settings.forEach(s => { companyInfo[s.name] = s.value; });
    } catch (dbErr) {
      // settings table not reachable, fall through with defaults below
    }

    let naicsSummary = '(not specified)';
    try {
      const [naics] = await db.query(
        'SELECT code, description, is_primary FROM naics_codes ORDER BY is_primary DESC, code'
      );
      if (naics.length > 0) {
        naicsSummary = naics
          .map(n => `${n.code} (${n.description})${n.is_primary ? ' [primary]' : ''}`)
          .join(', ');
      }
    } catch (dbErr) {
      // naics_codes table not reachable, fall through with default above
    }

    let capabilityStatement = '(not specified — add one in Bid Writing Guides, marked as a Template)';
    try {
      const [[guide]] = await db.query(
        "SELECT content FROM bid_writing_guides WHERE is_template = 1 ORDER BY sort_order LIMIT 1"
      );
      if (guide) capabilityStatement = guide.content;
    } catch (dbErr) {
      // bid_writing_guides table not reachable, fall through with default above
    }

    // Active pipeline so Claude can actually answer "what's in my
    // opportunities/grants" instead of only knowing static company profile
    // info. Capped and status-filtered to keep the prompt bounded — this is
    // context for conversation, not a full data export.
    let opportunitiesSummary = '(none — Opportunities list is empty)';
    let grantsSummary = '(none — no Grant-type opportunities on file)';
    try {
      const [opps] = await db.query(`
        SELECT o.id, o.title, o.opportunity_type, o.status, o.due_date, o.source, f.name AS funder_name
        FROM opportunities o
        LEFT JOIN grant_opportunities go ON go.opportunity_id = o.id
        LEFT JOIN funders f ON f.id = go.funder_id
        WHERE o.status NOT IN ('Not Pursuing','Closed')
        ORDER BY (o.due_date IS NULL), o.due_date ASC
        LIMIT 40
      `);

      const fmt = o => `#${o.id} "${o.title}" — ${o.opportunity_type}, ${o.status}` +
        (o.due_date ? `, due ${new Date(o.due_date).toLocaleDateString('en-US')}` : '') +
        (o.funder_name ? `, funder: ${o.funder_name}` : (o.source ? `, source: ${o.source}` : ''));

      const nonGrants = opps.filter(o => o.opportunity_type !== 'Grant');
      const grants = opps.filter(o => o.opportunity_type === 'Grant');

      if (opps.length > 0) opportunitiesSummary = opps.map(fmt).join('\n');
      if (grants.length > 0) grantsSummary = grants.map(fmt).join('\n');
      else if (nonGrants.length > 0) grantsSummary = '(none in the current active list — see opportunities above for other types)';
    } catch (dbErr) {
      // opportunities/grant_opportunities tables not reachable, fall through with defaults above
    }

    const systemPrompt = `You are a government contracting expert helping Legacy Planning & Preservation Ltd. evaluate opportunities and draft proposals.

COMPANY INFO:
Name: Legacy Planning & Preservation Ltd.
CAGE Code: ${companyInfo.company_cage || '(not specified)'}
UEI: ${companyInfo.company_uei || '(not specified)'}
Certifications: ${companyInfo.company_certifications || '(not specified)'}
NAICS Codes: ${naicsSummary}

CAPABILITY STATEMENT / BOILERPLATE:
${capabilityStatement}

ACTIVE OPPORTUNITIES (status not Closed/Not Pursuing, up to 40, soonest due date first):
${opportunitiesSummary}

ACTIVE GRANTS (subset of the above where type is Grant):
${grantsSummary}

When a user:
1. Pastes an opportunity or RFP → Evaluate fit against NAICS codes and capabilities. Rate 1-10. Explain why. List any red flags.
2. Asks for a proposal outline → Create a structured proposal outline based on the opportunity requirements and company capabilities.
3. Asks for research → Help research government agencies, contacts, or similar opportunities.
4. Asks questions → Answer using company context to help them pursue government contracts and grants.
5. Attaches a document → Read it as the primary source of truth for that turn (e.g. an RFP's actual requirements) over anything paraphrased in chat.
6. Asks about "my opportunities," "my pipeline," or "my grants" → Answer directly from the ACTIVE OPPORTUNITIES / ACTIVE GRANTS lists above — don't say you can't see them, and don't invent items not listed. If the list looks incomplete for what they're asking, say so and suggest checking the Opportunities or Pipeline page for the full record.

Be concise, professional, and action-oriented. Focus on helping them win contracts.`;

    const history = parseHistory(req.body.history);

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: userContent }]
    });

    const responseText = response.content[0].text;
    res.json({ response: responseText });
  } catch (err) {
    console.error('Claude API error:', err.message, err.status, err.error);

    let errorMsg = 'Chat failed. ';
    if (err.status === 401) {
      errorMsg = 'Invalid Claude API key — check it in Settings → API Keys.';
    } else if (err.status === 429) {
      errorMsg = 'Rate limited — too many requests. Wait a moment and try again.';
    } else if (err.status === 400) {
      errorMsg = 'Bad request — API key may be invalid or malformed.';
    } else if (err.message && err.message.includes('fetch')) {
      errorMsg = 'Network error — cannot reach Claude API. Check your connection.';
    } else if (err.message && err.message.includes('Unsupported file type')) {
      errorMsg = err.message;
    } else {
      errorMsg = 'Chat failed: ' + (err.message || 'Unknown error');
    }

    res.status(500).json({ error: errorMsg });
  }
});

module.exports = router;
