const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

const TARGETS = [
  { label: 'General internet (Google)', url: 'https://www.google.com/generate_204' },
  { label: 'SAM.gov API',               url: 'https://api.sam.gov' },
  { label: 'Grants.gov API',            url: 'https://api.grants.gov' },
  { label: 'USASpending API (IMLS too)',url: 'https://api.usaspending.gov' }
];

router.get('/network-check', async (req, res) => {
  const results = [];
  const targets = [...TARGETS];

  const relayUrl = process.env.SAM_RELAY_URL;
  const relaySecret = process.env.SAM_RELAY_SECRET;
  if (relayUrl) {
    targets.push({
      label: 'SAM.gov Relay (Cloudflare Worker)',
      url: `${relayUrl.replace(/\/$/, '')}?limit=1`,
      headers: relaySecret ? { 'x-relay-secret': relaySecret } : {}
    });
  } else {
    results.push({
      label: 'SAM.gov Relay (Cloudflare Worker)',
      url: '(not configured)',
      ok: false,
      ms: 0,
      error: 'SAM_RELAY_URL is not set in this app\'s environment variables — the relay setup isn\'t finished yet.'
    });
  }

  for (const target of targets) {
    const started = Date.now();
    try {
      const resp = await fetch(target.url, { method: 'GET', headers: target.headers || {}, signal: AbortSignal.timeout(10000) });
      results.push({ label: target.label, url: target.url, ok: true, ms: Date.now() - started, status: resp.status });
    } catch (err) {
      const detail = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
      results.push({ label: target.label, url: target.url, ok: false, ms: Date.now() - started, error: detail });
    }
  }

  res.render('diagnostics/network_check', { title: 'Network Diagnostics', results, checkedAt: new Date(), relayConfigured: !!relayUrl });
});

module.exports = router;
