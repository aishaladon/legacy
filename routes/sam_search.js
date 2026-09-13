const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const { scoreOpportunity } = require('../services/alignmentScorer');

router.use(requireLogin);

const SET_ASIDE_LABELS = {
  'SBA':      'Small Business',
  'WOSB':     'Women-Owned Small Business',
  'EDWOSB':   'Economically Disadvantaged WOSB',
  '8A':       '8(a)',
  '8AN':      '8(a) Sole Source',
  'HZC':      'HUBZone',
  'SDVOSBC':  'Service-Disabled Veteran-Owned SB',
  'SDVOSBS':  'SDVOSB Sole Source'
};

function formatDateParam(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

router.get('/', async (req, res) => {
  const { q, naics, set_aside, days, offset: rawOffset } = req.query;
  const searched = !!(q || naics || set_aside);
  let results = null;
  let total = 0;
  let error = null;
  const pageOffset = parseInt(rawOffset) || 0;
  const pageSize = 25;
  const SAM_MAX_LIMIT = 1000; // SAM.gov's own documented ceiling on records per call

  const apiKey = process.env.SAM_API_KEY;
  const relayUrl = process.env.SAM_RELAY_URL;
  const relaySecret = process.env.SAM_RELAY_SECRET;
  const hasKey = !!(relayUrl || apiKey);

  if (hasKey && searched) {
    try {
      const daysBack = parseInt(days) || 90;
      const now = new Date();
      const from = new Date(now.getTime() - daysBack * 86400000);

      // SAM.gov's own offset+limit pagination is unreliable past page 1 — it
      // can report the correct totalRecords while returning a zero-length
      // opportunitiesData array for a perfectly valid non-zero offset (seen
      // live: 113 total, offset=25, empty page). This isn't anything wrong
      // with our request; it's a known instability in SAM.gov's own search
      // backend. Work around it by always fetching from offset 0 through
      // the current page in one call, then slicing out the window we want
      // locally — SAM.gov supports up to 1000 records per call, which
      // covers virtually every real search here.
      const fetchLimit = Math.min(SAM_MAX_LIMIT, pageOffset + pageSize);
      const params = new URLSearchParams({
        limit: String(fetchLimit),
        offset: '0',
        postedFrom: formatDateParam(from),
        postedTo: formatDateParam(now)
      });

      // SAM.gov's opportunities API uses "title" for keyword search (not "q")
      // and "ncode" for NAICS (not "naicsCode") — both were silently ignored
      // before, which is why every search returned the same unfiltered set.
      if (q) params.set('title', q);
      if (naics) params.set('ncode', naics);
      if (set_aside) params.set('typeOfSetAside', set_aside);

      let resp;
      if (relayUrl) {
        // Hostinger can't reach api.sam.gov directly (blocked outbound), so
        // route through a Cloudflare Worker relay that injects the real key
        // server-side and forwards SAM.gov's response back unchanged.
        resp = await fetch(`${relayUrl.replace(/\/$/, '')}?${params.toString()}`, {
          headers: {
            Accept: 'application/json',
            ...(relaySecret ? { 'x-relay-secret': relaySecret } : {})
          },
          signal: AbortSignal.timeout(20000)
        });
      } else {
        params.set('api_key', apiKey);
        resp = await fetch(`https://api.sam.gov/opportunities/v2/search?${params.toString()}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000)
        });
      }

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`SAM.gov returned ${resp.status}: ${txt.slice(0, 300)}`);
      }

      const data = await resp.json();
      total = data.totalRecords || 0;

      const allResults = (data.opportunitiesData || []).map(o => ({
        noticeId: o.noticeId || '',
        title: o.title || '(untitled)',
        solicitationNumber: o.solicitationNumber || '',
        agency: (o.fullParentPathName || '').split('.').pop().trim() || o.organizationName || '',
        fullAgency: o.fullParentPathName || '',
        naicsCode: o.naicsCode || '',
        setAside: o.typeOfSetAsideDescription || SET_ASIDE_LABELS[o.typeOfSetAside] || o.typeOfSetAside || '',
        type: o.type || '',
        postedDate: o.publishDate ? o.publishDate.split('T')[0] : '',
        dueDate: o.responseDeadLine ? o.responseDeadLine.split('T')[0] : '',
        samUrl: o.uiLink || `https://sam.gov/opp/${o.noticeId}/view`
      }));

      // allResults already starts at offset 0, so slice out just this page's
      // window — this is the actual pagination now, not SAM.gov's.
      results = allResults.slice(pageOffset, pageOffset + pageSize);
    } catch (err) {
      error = err.cause ? `${err.message} (${err.cause.message || err.cause})` : err.message;
    }
  }

  res.render('sam_search/index', {
    title: 'SAM.gov Search',
    results,
    error,
    total,
    hasKey,
    searched,
    filters: { q: q || '', naics: naics || '', set_aside: set_aside || '', days: days || '90' },
    setAsides: SET_ASIDE_LABELS,
    pageOffset,
    pageSize
  });
});

router.post('/save', async (req, res) => {
  const {
    title, solicitation_number, agency, full_agency,
    naics_code, set_aside, due_date, posted_date, sam_url, notice_id
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [r] = await conn.query(`
      INSERT INTO opportunities
        (title, opportunity_type, source, source_url, posted_date, due_date, status)
      VALUES (?,?,?,?,?,?,?)
    `, [
      title, 'Government Contract', 'SAM.gov',
      sam_url || null, posted_date || null, due_date || null, 'New'
    ]);

    await conn.query(`
      INSERT INTO government_contracts
        (opportunity_id, solicitation_number, agency, naics_code, set_aside, sam_notice_id)
      VALUES (?,?,?,?,?,?)
    `, [
      r.insertId,
      solicitation_number || null,
      full_agency || agency || null,
      naics_code || null,
      set_aside || null,
      notice_id || null
    ]);

    await conn.query(
      'INSERT INTO activity_log (record_type, record_id, action, description) VALUES (?,?,?,?)',
      ['opportunity', r.insertId, 'created', `Imported from SAM.gov: ${title}`]
    );

    await conn.commit();
    await scoreOpportunity(r.insertId).catch(() => {});
    req.flash('success', `Saved: ${title}`);
    res.redirect(`/opportunities/${r.insertId}`);
  } catch (err) {
    await conn.rollback();
    req.flash('error', 'Could not save: ' + err.message);
    res.redirect('/sam-search');
  } finally {
    conn.release();
  }
});

module.exports = router;
