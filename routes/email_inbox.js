const express = require('express');
const router = express.Router();
const { simpleParser } = require('mailparser');
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const { getClaudeApiKey } = require('../utils/claudeApiKey');
const { extractResponseText } = require('../utils/claudeResponseText');
const { parseJsonLoose } = require('../utils/parseJsonLoose');
const { createImapClient } = require('../utils/imapClient');

router.use(requireLogin);

let lastEmailSync = null;

db.query(`
  CREATE TABLE IF NOT EXISTS email_actions (
    uid VARCHAR(100) NOT NULL,
    action ENUM('converted','archived') NOT NULL,
    opportunity_id INT NULL,
    acted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (uid)
  )
`).catch(() => {});

db.query(`
  CREATE TABLE IF NOT EXISTS email_relevance (
    uid VARCHAR(100) NOT NULL PRIMARY KEY,
    marker CHAR(1) NOT NULL,
    reason VARCHAR(300),
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).catch(() => {});

const OPPORTUNITY_KEYWORDS = [
  'contract', 'opportunity', 'opportunities', 'bid', 'grant', 'grants',
  'rfp', 'rfq', 'solicitation', 'procurement', 'award', 'federal',
  'govcon', 'sbir', 'sttr', 'proposal', 'subcontract', 'naics',
  'mybidmatch', 'govexpert', 'funding', 'government', 'sam.gov',
  'teaming', 'performance work', 'sources sought', 'notice'
];

const OPPORTUNITY_DOMAINS = [
  'govexpert.info', 'mybidmatch.com', 'sam.gov', 'grants.gov', 'sba.gov',
  'fpds.gov', 'usaspending.gov', 'governmentservicesexchange.com',
  'govwin.com', 'deltek.com', 'bgov.com', 'archivesgig.com', 'archivesgig.wordpress.com'
];

const DIGEST_DOMAINS = ['mybidmatch.com', 'govexpert.info', 'grants.gov', 'sam.gov'];
const DIGEST_SUBJECT_KEYWORDS = ['daily opportunities', 'bid match', 'daily digest', 'opportunity alert', 'weekly roundup', 'opportunity update'];
const ARCHIVESGIG_DOMAINS = ['archivesgig.com', 'archivesgig.wordpress.com'];
const ARCHIVESGIG_KEYWORDS = ['archivesgig', 'archives gig', 'library', 'archive', 'intern', 'records'];

function isOpportunityEmail(subject, from) {
  const s = (subject || '').toLowerCase();
  const f = (from || '').toLowerCase();
  if (OPPORTUNITY_DOMAINS.some(d => f.includes(d))) return true;
  if (OPPORTUNITY_KEYWORDS.some(k => s.includes(k))) return true;
  return false;
}

// MyBidMatch-style bullet notices: "D -- Altair Units Enterprise Suite (DEPT OF DEFENSE)"
// State/local notices use a single dash instead of a double dash:
// "R - RFP for Records Digitization and Cataloguing Services (New Hampshire ...)"
const BULLET_START_RE = /^(?:[•\-\*]\s*)?[A-Z]{1,3}\d{0,4}\s*-{1,2}\s*/;
const BULLET_ITEM_RE = /^(?:[•\-\*]\s*)?[A-Z]{1,3}\d{0,4}\s*-{1,2}\s*.+\([^()]*\)\s*$/;

// Long agency names sometimes wrap onto a continuation line in the plain-text
// body — join any line that doesn't start a new bullet onto the previous one
// so the whole notice (including its trailing "(Agency)") ends up on one line.
function joinWrappedBulletLines(body) {
  const rawLines = (body || '').split('\n').map(l => l.trim()).filter(Boolean);
  const merged = [];
  for (const line of rawLines) {
    const prev = merged[merged.length - 1];
    // Only continue the previous line if it started a bullet AND hasn't
    // reached its closing paren yet — otherwise trailing boilerplate after
    // the last bullet (e.g. "Click this link... to view all articles.")
    // gets glued onto it and breaks the closing-paren match.
    const prevIsOpenBullet = prev && BULLET_START_RE.test(prev) && !/\)\s*$/.test(prev);
    if (prevIsOpenBullet) {
      merged[merged.length - 1] += ' ' + line;
    } else {
      merged.push(line);
    }
  }
  return merged;
}

function isDigestEmail(subject, fromAddress, body) {
  const s = (subject || '').toLowerCase();
  const f = (fromAddress || '').toLowerCase();
  if (DIGEST_DOMAINS.some(d => f.includes(d))) return true;
  if (DIGEST_SUBJECT_KEYWORDS.some(k => s.includes(k))) return true;
  // Detect by presence of 3+ numbered list items in body (e.g. "1. Title")
  const numbered = ((body || '').match(/^\s*\d+[\.\)]\s/gm) || []);
  if (numbered.length >= 3) return true;
  // Or 3+ bullet-coded notices (MyBidMatch-style: "B -- Title (Agency)")
  const bulleted = joinWrappedBulletLines(body).filter(l => BULLET_ITEM_RE.test(l));
  return bulleted.length >= 3;
}

// Only treat an ArchivesGig email as a single job posting when the subject
// actually has the "Location: Title, Organization" shape — ArchivesGig also
// sends general newsletter posts (e.g. training program roundups) that don't
// fit that template and would otherwise render with empty fields.
function isArchivesgigJobShaped(subject) {
  const m = (subject || '').match(/^([^:]+):\s*(.+)$/);
  return !!(m && m[2].includes(','));
}

function isArchivesgigEmail(subject, fromAddress, body) {
  const s = (subject || '').toLowerCase();
  const f = (fromAddress || '').toLowerCase();
  const b = (body || '').toLowerCase();
  if (ARCHIVESGIG_DOMAINS.some(d => f.includes(d))) return true;
  if (s.includes('archivesgig') || b.includes('archivesgig')) return true;
  return false;
}

// Parse a single ArchiveGig job email
function parseArchivesgigEmail(subject, body) {
  // Subject typically: "Location: Job Title, Organization"
  // Body has "By Author on Date"

  // Extract location from subject (before colon)
  const locationMatch = subject.match(/^([^:]+):\s*(.+)$/);
  const location = locationMatch ? locationMatch[1].trim() : '';
  const titleAndOrg = locationMatch ? locationMatch[2].trim() : subject;

  // Try to split title and organization (usually separated by comma)
  const parts = titleAndOrg.split(',');
  const title = parts[0]?.trim() || titleAndOrg;
  const organization = parts.slice(1).join(',').trim() || '';

  // Extract date from body (By Author on Date)
  const dateMatch = body.match(/by\s+[\w\s]+\s+on\s+(\w+\s+\d{1,2},?\s+\d{4})/i);
  const dateStr = dateMatch ? dateMatch[1] : '';

  return {
    title,
    location,
    organization,
    dateStr,
    body,
    opportunityType: 'Job'
  };
}

// Parse a digest email body into individual opportunity objects
function parseDigestEmail(body) {
  const results = [];

  // Strategy: split on lines that start with a number followed by . or )
  const segments = body.split(/\n(?=\s*\d{1,3}[\.\)]\s)/);
  const items = segments.filter(s => /^\s*\d+[\.\)]\s/.test(s.trim()));

  items.forEach((block, idx) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    // Remove the leading number from the title line
    const title = lines[0].replace(/^\d+[\.\)]\s*/, '').replace(/\*+/g, '').trim();
    if (!title || title.length < 4) return;

    const blockText = block;

    // Due date — many formats
    const dateMatch = blockText.match(
      /(?:due(?:\s+date)?|deadline|response\s+due|close[sd]?|submit(?:tal)?)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i
    );
    let dueDate = '';
    if (dateMatch) {
      const parts = dateMatch[1].split(/[\/\-]/);
      if (parts.length === 3) {
        const yr = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        dueDate = `${yr}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
      }
    }

    // Source URL
    const urlMatch = blockText.match(/https?:\/\/[^\s\)\]>,"]+/);
    const sourceUrl = urlMatch ? urlMatch[0].replace(/[.,;'"]+$/, '') : '';

    // Opportunity type
    const bt = blockText.toLowerCase();
    let opportunityType = 'Government Contract';
    if (bt.includes('grant')) opportunityType = 'Grant';
    else if (bt.includes('subcontract')) opportunityType = 'Subcontract';
    else if (bt.includes('job') || bt.includes('staffing')) opportunityType = 'Job';

    // Source/agency — look for "Agency:", "Contracting Office:", "Issuing Office:"
    const agencyMatch = blockText.match(/(?:agency|contracting office|issuing office|posted by)[:\s]+(.+)/i);
    const agency = agencyMatch ? agencyMatch[1].trim().slice(0, 100) : '';

    // NAICS code
    const naicsMatch = blockText.match(/naics[:\s#]+(\d{5,6})/i);
    const naics = naicsMatch ? naicsMatch[1] : '';

    results.push({
      index: idx,
      title,
      dueDate,
      sourceUrl,
      opportunityType,
      agency,
      naics,
      preview: lines.slice(1, 5).join(' | '),
      body: blockText.length > 800 ? blockText.slice(0, 800) + '...' : blockText
    });
  });

  return results;
}

// MyBidMatch emails include a link to the subscriber's persistent bid
// listing (mybidmatch.outreachsystems.com/go?sub=...), which lists every
// matched bid for the last 30 days and links through to each bid's full
// abstract. That per-notice detail isn't in the plain-text body, so this is
// the closest real, clickable "more info" link we can attach to each parsed
// opportunity — prefer it, fall back to the first URL in the body otherwise.
function extractDigestLink(body) {
  const text = body || '';
  const preferred = text.match(/https?:\/\/[^\s\)\]>,"']*(?:mybidmatch|outreachsystems|govexpert)[^\s\)\]>,"']*/i);
  if (preferred) return preferred[0].replace(/[.,;'")\]]+$/, '');
  const anyUrl = text.match(/https?:\/\/[^\s\)\]>,"']+/);
  return anyUrl ? anyUrl[0].replace(/[.,;'")\]]+$/, '') : '';
}

// Parse MyBidMatch-style digest emails, where each notice is one line:
// "B -- B--Notice of Intent to Sole Source (INTERIOR, DEPARTMENT OF THE, ...)"
// — a leading category code, "--", the title, then agency hierarchy in
// trailing parentheses. This is a completely different shape than the
// numbered-list digests parseDigestEmail handles, so it needs its own pass.
function parseBulletDigestEmail(body) {
  const digestUrl = extractDigestLink(body);
  const lines = joinWrappedBulletLines(body);
  const seen = new Set();
  const results = [];

  lines.forEach((line, idx) => {
    if (!BULLET_ITEM_RE.test(line)) return;

    const m = line.match(/^(?:[•\-\*]\s*)?[A-Z]{1,3}\s*-{1,2}\s*(.+)$/);
    if (!m) return;

    // Titles usually repeat the leading code (sometimes with digits, e.g.
    // "R606--RFQ: ...") right before the real title — strip that too.
    const rest = m[1].replace(/^[A-Z]{1,3}\d{0,4}\s*-{1,2}\s*/, '').trim();

    let title = rest;
    let agency = '';
    const parenMatch = rest.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (parenMatch) {
      title = parenMatch[1].trim();
      agency = parenMatch[2].split(',').slice(0, 2).map(s => s.trim()).join(', ');
    }

    if (!title || title.length < 4) return;

    // Digests sometimes repeat the same notice (seen in real MyBidMatch mail).
    const dedupeKey = title.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    results.push({
      index: idx,
      title,
      dueDate: '',
      sourceUrl: digestUrl,
      opportunityType: 'Government Contract',
      agency,
      naics: '',
      preview: agency || line,
      body: line
    });
  });

  return results;
}

// Classifies opportunity emails as worth reviewing ($) or not (#) so the
// inbox list can be triaged without opening each one. Batched (not one call
// per email) and cached in email_relevance so repeat page loads don't
// re-classify — only genuinely new emails cost an API call.
async function classifyEmailRelevance(items) {
  const apiKey = await getClaudeApiKey();
  if (!apiKey) {
    console.error('Email relevance classification skipped: no Claude API key set (Settings -> API Keys).');
    return {};
  }
  if (items.length === 0) return {};

  const results = {};
  const BATCH = 20;

  for (let start = 0; start < items.length; start += BATCH) {
    const chunk = items.slice(start, start + BATCH);
    try {
      const client = new Anthropic({ apiKey });
      const text = chunk.map((it, i) =>
        `[${i}] Subject: ${it.subject}\nBody:\n${(it.body || '').slice(0, 1500)}`
      ).join('\n\n---\n\n');

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Legacy Planning & Preservation Ltd. is a government contracting and grants consultancy focused on records management, archives, museums, and libraries. Triage each email below for whether it's worth this company's time to open and review, vs. safe to archive unread.

Mark "$" if the email contains (or is likely to contain) at least one contract, grant, or job opportunity plausibly relevant to records management, archives, museums, libraries, historic preservation, or digitization work — even if only one item in a larger digest qualifies. Mark "#" if the email is generic, off-topic (e.g. construction, IT hardware, medical, unrelated industries), a newsletter with no actual opportunities, or otherwise not worth opening.

Respond ONLY with valid JSON (no markdown):
{"items": [{"index": 0, "marker": "$", "reason": "<under 15 words>"}]}

EMAILS:
${text}`
        }]
      });

      const content = extractResponseText(response).trim();
      let parsed;
      try {
        parsed = parseJsonLoose(content);
      } catch (parseErr) {
        console.error('Email relevance classification: could not parse Claude response as JSON.', parseErr.message, '\nRaw response:', content.slice(0, 500));
        continue;
      }
      (parsed.items || []).forEach(it => {
        const original = chunk[it.index];
        if (original && (it.marker === '$' || it.marker === '#')) {
          results[original.uid] = { marker: it.marker, reason: it.reason || '' };
        }
      });
    } catch (err) {
      const detail = err.status ? `HTTP ${err.status}: ${err.message}` : err.message;
      console.error('Email relevance classification error:', detail);
      // leave this chunk unclassified — no marker is shown rather than a wrong one
    }
  }

  return results;
}

// Evaluate opportunities with Claude
async function evaluateOpportunitiesWithClaude(opportunities) {
  const apiKey = await getClaudeApiKey();
  if (!apiKey) return opportunities; // Skip if no API key

  try {
    const client = new Anthropic({ apiKey });
    const oppTexts = opportunities
      .map(o => `Title: ${o.title}\nAgency: ${o.agency}\nType: ${o.opportunityType}\nBody: ${o.body}`)
      .join('\n\n---\n\n');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `You are evaluating government contract/grant opportunities for Legacy Planning & Preservation Ltd.

Score each opportunity 1-10 for fit. Respond ONLY with valid JSON (no markdown):

{
  "scores": [
    {"index": 0, "fit_score": <1-10>, "reasoning": "<brief reason>"},
    {"index": 1, "fit_score": <1-10>, "reasoning": "<brief reason>"},
    ...
  ]
}

OPPORTUNITIES:
${oppTexts}`
        }
      ]
    });

    const content = extractResponseText(response).trim();
    let scores = {};

    try {
      const result = JSON.parse(content);
      result.scores?.forEach(s => {
        scores[s.index] = s;
      });
    } catch (_) {
      return opportunities; // Fallback if parsing fails
    }

    return opportunities.map((opp, idx) => ({
      ...opp,
      fit_score: scores[idx]?.fit_score || null,
      fit_reasoning: scores[idx]?.reasoning || ''
    }));
  } catch (err) {
    console.error('Claude evaluation error:', err);
    return opportunities; // Fallback on error
  }
}

function formatFrom(envFrom) {
  if (!envFrom || !envFrom.length) return 'Unknown';
  const f = envFrom[0];
  if (f.name) return `${f.name} <${f.address}>`;
  return f.address || 'Unknown';
}

async function fetchEmailBody(uid) {
  const client = createImapClient();
  let email = null;
  try {
    await client.connect();
    await client.mailboxOpen('INBOX', { readOnly: true });
    for await (const msg of client.fetch(String(uid), {
      envelope: true, source: true, uid: true
    }, { uid: true })) {
      const parsed = await simpleParser(msg.source);
      email = {
        uid: String(msg.uid),
        from: formatFrom(msg.envelope.from),
        fromAddress: msg.envelope.from?.[0]?.address || '',
        subject: msg.envelope.subject || '(no subject)',
        date: msg.envelope.date,
        body: parsed.text || ''
      };
    }
    await client.logout();
  } catch (err) {
    try { await client.logout(); } catch (_) {}
    throw err;
  }
  return email;
}

// ── List inbox ───────────────────────────────────────────
router.get('/', async (req, res) => {
  const showAll = req.query.show === 'all';
  const client = createImapClient();
  let messages = [];
  let error = null;
  let previewTruncated = false;

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen('INBOX', { readOnly: true });
    const total = mailbox.exists;

    if (total > 0) {
      const fetchCount = Math.min(total, 200);
      const start = Math.max(1, total - fetchCount + 1);
      const raw = [];

      for await (const msg of client.fetch(`${start}:*`, {
        envelope: true, flags: true, uid: true
      })) {
        raw.push({
          uid: String(msg.uid),
          from: formatFrom(msg.envelope.from),
          fromAddress: msg.envelope.from?.[0]?.address || '',
          subject: msg.envelope.subject || '(no subject)',
          date: msg.envelope.date,
          seen: msg.flags.has('\\Seen')
        });
      }

      const filtered = showAll ? raw : raw.filter(m => isOpportunityEmail(m.subject, m.from));

      const uids = filtered.map(m => m.uid);
      let actedMap = {};
      if (uids.length > 0) {
        const placeholders = uids.map(() => '?').join(',');
        const [rows] = await db.query(
          `SELECT uid, action, opportunity_id FROM email_actions WHERE uid IN (${placeholders})`,
          uids
        );
        rows.forEach(r => { actedMap[r.uid] = r; });
      }

      messages = filtered
        .map(m => ({ ...m, action: actedMap[m.uid] || null }))
        .filter(m => showAll || !m.action || m.action.action !== 'archived')
        .reverse();

      // Pull actual content from the body of each opportunity email so the
      // list shows what the opportunity is, not just a subject line —
      // digest emails get an extracted item count, everything else gets a
      // plain-text excerpt. Capped to bound how many bodies get fetched.
      const PREVIEW_LIMIT = 40;
      const previewCandidates = messages.filter(m => isOpportunityEmail(m.subject, m.from));
      const toPreview = previewCandidates.slice(0, PREVIEW_LIMIT);
      previewTruncated = previewCandidates.length > PREVIEW_LIMIT;

      if (toPreview.length > 0) {
        const bodies = {};
        // Fetch each body individually (same single-UID call shape as the
        // working Convert page) rather than one bulk comma-joined-UID fetch —
        // the bulk fetch was silently returning zero results, blanking every
        // preview with no error surfaced.
        for (const m of toPreview) {
          try {
            for await (const msg of client.fetch(m.uid, { source: true, uid: true }, { uid: true })) {
              const parsed = await simpleParser(msg.source);
              bodies[m.uid] = parsed.text || parsed.html || '';
            }
          } catch (previewErr) {
            console.error(`Email preview fetch failed for uid ${m.uid}:`, previewErr.message);
          }
        }

        messages = messages.map(m => {
          const body = bodies[m.uid];
          if (body === undefined) return { ...m, previewError: true };

          if (isDigestEmail(m.subject, m.fromAddress, body)) {
            let items = parseDigestEmail(body);
            if (items.length === 0) items = parseBulletDigestEmail(body);
            return {
              ...m,
              previewCount: items.length,
              previewTitles: items.slice(0, 2).map(i => i.title),
              previewUrl: items[0]?.sourceUrl || extractDigestLink(body) || null
            };
          }

          const urlMatch = body.match(/https?:\/\/[^\s\)\]>,"]+/);
          const cleaned = body.replace(/\s+/g, ' ').trim();
          return {
            ...m,
            previewText: cleaned.length > 200 ? cleaned.slice(0, 200) + '…' : cleaned,
            previewUrl: urlMatch ? urlMatch[0].replace(/[.,;'"]+$/, '') : null
          };
        });

        // $ / # relevance markers — cached per email so only genuinely new
        // messages cost a Claude call on subsequent page loads.
        const fetchedUids = Object.keys(bodies);
        let relevanceMap = {};
        if (fetchedUids.length > 0) {
          const placeholders = fetchedUids.map(() => '?').join(',');
          const [cached] = await db.query(
            `SELECT uid, marker, reason FROM email_relevance WHERE uid IN (${placeholders})`,
            fetchedUids
          );
          cached.forEach(r => { relevanceMap[r.uid] = { marker: r.marker, reason: r.reason }; });

          const uncached = fetchedUids.filter(uid => !relevanceMap[uid]);
          if (uncached.length > 0) {
            const toClassify = uncached.map(uid => {
              const m = messages.find(msg => msg.uid === uid);
              return { uid, subject: m ? m.subject : '', body: bodies[uid] };
            });
            const classified = await classifyEmailRelevance(toClassify);
            for (const [uid, result] of Object.entries(classified)) {
              relevanceMap[uid] = result;
              await db.query(
                'INSERT INTO email_relevance (uid, marker, reason) VALUES (?,?,?) ON DUPLICATE KEY UPDATE marker=VALUES(marker), reason=VALUES(reason)',
                [uid, result.marker, result.reason]
              ).catch(() => {});
            }
          }
        }

        messages = messages.map(m => relevanceMap[m.uid] ? { ...m, relevance: relevanceMap[m.uid] } : m);
      }
    }

    await client.logout();
  } catch (err) {
    error = err.message;
    try { await client.logout(); } catch (_) {}
  }

  if (!error) lastEmailSync = new Date();

  res.render('email_inbox/index', { title: 'Email Inbox', messages, error, showAll, lastEmailSync, previewTruncated });
});

// ── Single convert view ──────────────────────────────────
router.get('/:uid/convert', async (req, res) => {
  let email = null;
  try {
    email = await fetchEmailBody(req.params.uid);
  } catch (err) {
    req.flash('error', err.message);
    return res.redirect('/email-inbox');
  }
  if (!email) { req.flash('error', 'Email not found.'); return res.redirect('/email-inbox'); }

  // Only offer the "Parse & Import All" banner when it would actually find
  // something — some emails match the digest heuristics (domain/keywords)
  // but genuinely contain no separately-listed opportunities.
  let digest = false;
  if (isDigestEmail(email.subject, email.fromAddress, email.body)) {
    let items = parseDigestEmail(email.body);
    if (items.length === 0) items = parseBulletDigestEmail(email.body);
    digest = items.length > 0;
  }
  const archivesgig = isArchivesgigEmail(email.subject, email.fromAddress, email.body)
    && isArchivesgigJobShaped(email.subject);

  if (archivesgig) {
    const job = parseArchivesgigEmail(email.subject, email.body);
    return res.render('email_inbox/convert-archivesgig', {
      title: 'Evaluate Job with AI',
      email,
      job
    });
  }

  const bodyPreview = email.body.length > 3000
    ? email.body.slice(0, 3000) + '\n\n[...email truncated...]'
    : email.body;

  res.render('email_inbox/convert', {
    title: 'Convert Email to Opportunity',
    email: { ...email, body: bodyPreview },
    isDigest: digest,
    digestUrl: digest ? extractDigestLink(email.body) : '',
    sourceUrl: extractDigestLink(email.body)
  });
});

// ── Parse digest into multiple opportunities ─────────────
router.get('/:uid/parse', async (req, res) => {
  let email = null;
  try {
    email = await fetchEmailBody(req.params.uid);
  } catch (err) {
    req.flash('error', err.message);
    return res.redirect('/email-inbox');
  }
  if (!email) { req.flash('error', 'Email not found.'); return res.redirect('/email-inbox'); }

  let opportunities = parseDigestEmail(email.body);
  if (opportunities.length === 0) {
    opportunities = parseBulletDigestEmail(email.body);
  }
  opportunities = await evaluateOpportunitiesWithClaude(opportunities);
  opportunities.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));

  res.render('email_inbox/parse', {
    title: 'Import Opportunities from Email',
    email,
    opportunities
  });
});

// ── Save parsed opportunities (bulk) ────────────────────
router.post('/:uid/parse-save', async (req, res) => {
  const { uid } = req.params;
  const opps = req.body.opps || {};
  let saved = 0;

  try {
    for (const [, opp] of Object.entries(opps)) {
      if (opp.selected !== '1') continue;
      if (!opp.title || !opp.title.trim()) continue;

      const [result] = await db.query(`
        INSERT INTO opportunities
          (title, opportunity_type, source, source_url, due_date, description, status)
        VALUES (?,?,?,?,?,?,?)
      `, [
        opp.title.trim(),
        opp.opportunity_type || 'Government Contract',
        opp.source || null,
        opp.source_url || null,
        opp.due_date || null,
        opp.description || null,
        'New'
      ]);

      await db.query(
        'INSERT INTO activity_log (record_type, record_id, action, description) VALUES (?,?,?,?)',
        ['opportunity', result.insertId, 'created', `Imported from email digest: ${opp.title.trim()}`]
      );

      saved++;
    }

    await db.query(
      `INSERT INTO email_actions (uid, action) VALUES (?, 'converted')
       ON DUPLICATE KEY UPDATE action='converted', acted_at=NOW()`,
      [uid]
    ).catch(() => {});

    req.flash('success', `${saved} opportunit${saved === 1 ? 'y' : 'ies'} imported from email digest.`);
    res.redirect('/opportunities');
  } catch (err) {
    req.flash('error', 'Import failed: ' + err.message);
    res.redirect('/email-inbox');
  }
});

// ── Save single opportunity ──────────────────────────────
router.post('/:uid/save', async (req, res) => {
  const { uid } = req.params;
  const {
    title, opportunity_type, source, source_url, posted_date, due_date,
    amount_min, amount_max, description, region, status, is_starred
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO opportunities
        (title, opportunity_type, source, source_url, posted_date, due_date,
         amount_min, amount_max, description, region, status, is_starred)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      title, opportunity_type, source || null, source_url || null,
      posted_date || null, due_date || null,
      amount_min || null, amount_max || null,
      description || null, region || null,
      status || 'New', is_starred ? 1 : 0
    ]);

    await db.query(
      'INSERT INTO activity_log (record_type, record_id, action, description) VALUES (?,?,?,?)',
      ['opportunity', result.insertId, 'created', `Created from email: ${title}`]
    );

    await db.query(
      `INSERT INTO email_actions (uid, action, opportunity_id) VALUES (?, 'converted', ?)
       ON DUPLICATE KEY UPDATE action='converted', opportunity_id=VALUES(opportunity_id), acted_at=NOW()`,
      [uid, result.insertId]
    );

    req.flash('success', 'Opportunity saved and email marked as converted.');
    res.redirect(`/opportunities/${result.insertId}`);
  } catch (err) {
    req.flash('error', 'Could not save opportunity: ' + err.message);
    res.redirect('/email-inbox');
  }
});

// ── Evaluate ArchiveGig job with Claude ─────────────────
router.post('/:uid/evaluate-archivesgig-api', async (req, res) => {
  const { title, location, organization, body } = req.body;
  const apiKey = await getClaudeApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'Claude API key not set. Go to Settings → API Keys to add it.' });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are evaluating archival and library job postings for Legacy Planning & Preservation Ltd.

Evaluate this job posting and respond ONLY with valid JSON (no markdown):

{
  "fit_score": <1-10>,
  "reasoning": "<2-3 sentence explanation>",
  "recommendation": "<Apply or Pass>"
}

JOB POSTING:
Title: ${title}
Location: ${location}
Organization: ${organization}

Full Description:
${body}`
        }
      ]
    });

    const content = extractResponseText(response).trim();
    let evaluation;

    try {
      evaluation = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ error: 'Could not parse Claude response.' });
    }

    res.json(evaluation);
  } catch (err) {
    console.error('Claude API error:', err);
    let errorMsg = 'Evaluation failed. Please try again.';
    if (err.status === 401) {
      errorMsg = 'Invalid Claude API key — check it in Settings → API Keys.';
    } else if (err.status === 429) {
      errorMsg = 'Rate limited — too many requests. Wait a moment and try again.';
    }
    res.status(500).json({ error: errorMsg });
  }
});

// ── Save ArchiveGig job ──────────────────────────────────
router.post('/:uid/save-archivesgig', async (req, res) => {
  const { uid } = req.params;
  const { title, location, organization, fit_score } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO opportunities
        (title, opportunity_type, region, source, description, status)
      VALUES (?,?,?,?,?,?)
    `, [
      title,
      'Job',
      location || null,
      organization || 'ArchiveGig',
      `Organization: ${organization}\nPosted on ArchiveGig`,
      'New'
    ]);

    if (fit_score) {
      await db.query('UPDATE opportunities SET alignment_score = ? WHERE id = ?', [fit_score, result.insertId]);
    }

    await db.query(
      'INSERT INTO activity_log (record_type, record_id, action, description) VALUES (?,?,?,?)',
      ['opportunity', result.insertId, 'created', `ArchiveGig job: ${title}`]
    );

    await db.query(
      `INSERT INTO email_actions (uid, action, opportunity_id) VALUES (?, 'converted', ?)
       ON DUPLICATE KEY UPDATE action='converted', opportunity_id=VALUES(opportunity_id), acted_at=NOW()`,
      [uid, result.insertId]
    );

    req.flash('success', 'Job saved to Opportunities.');
    res.redirect(`/opportunities/${result.insertId}`);
  } catch (err) {
    req.flash('error', 'Could not save job: ' + err.message);
    res.redirect('/email-inbox');
  }
});

router.post('/:uid/archive', async (req, res) => {
  const { uid } = req.params;
  await db.query(
    `INSERT INTO email_actions (uid, action) VALUES (?, 'archived')
     ON DUPLICATE KEY UPDATE action='archived', acted_at=NOW()`,
    [uid]
  ).catch(() => {});
  res.redirect('/email-inbox');
});

module.exports = router;
