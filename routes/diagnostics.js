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

  for (const target of TARGETS) {
    const started = Date.now();
    try {
      await fetch(target.url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      results.push({ label: target.label, url: target.url, ok: true, ms: Date.now() - started });
    } catch (err) {
      const detail = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
      results.push({ label: target.label, url: target.url, ok: false, ms: Date.now() - started, error: detail });
    }
  }

  res.render('diagnostics/network_check', { title: 'Network Diagnostics', results });
});

module.exports = router;
