const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

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
      model: 'claude-opus-4-8',
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

router.post('/claude-chat', requireLogin, async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const [[apiKeyRow]] = await db.query("SELECT value FROM user_settings WHERE name='claude_api_key'");
  const apiKey = apiKeyRow ? apiKeyRow.value : null;

  if (!apiKey) {
    return res.status(500).json({ error: 'Claude API key not set. Go to Settings → API Keys to add it.' });
  }

  try {
    const client = new Anthropic({ apiKey });

    let companyInfo = {};
    try {
      const [settings] = await db.query("SELECT name, value FROM user_settings WHERE name IN ('company_name', 'company_mission', 'company_naics_codes', 'company_capabilities', 'company_background')");
      settings.forEach(s => { companyInfo[s.name] = s.value; });
    } catch (dbErr) {
      // company settings not found, use defaults
    }

    const systemPrompt = `You are a government contracting expert helping Legacy Planning & Preservation Ltd. evaluate opportunities and draft proposals.

COMPANY INFO:
Name: ${companyInfo.company_name || 'Legacy Planning & Preservation Ltd.'}
Mission: ${companyInfo.company_mission || '(not specified)'}
NAICS Codes: ${companyInfo.company_naics_codes || '(not specified)'}
Capability Statement: ${companyInfo.company_capabilities || '(not specified)'}
Background: ${companyInfo.company_background || '(not specified)'}

When a user:
1. Pastes an opportunity or RFP → Evaluate fit against NAICS codes and capabilities. Rate 1-10. Explain why. List any red flags.
2. Asks for a proposal outline → Create a structured proposal outline based on the opportunity requirements and company capabilities.
3. Asks for research → Help research government agencies, contacts, or similar opportunities.
4. Asks questions → Answer using company context to help them pursue government contracts and grants.

Be concise, professional, and action-oriented. Focus on helping them win contracts.`;

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }]
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
    } else {
      errorMsg = 'Chat failed: ' + (err.message || 'Unknown error');
    }

    res.status(500).json({ error: errorMsg });
  }
});

module.exports = router;
