require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const db        = require('./db-mysql');
const anthropic = require('./anthropic');
const { uploadToNAS } = require('./nas');
const { hashPassword, checkPassword, signToken, requireAuth } = require('./auth');
const { buildGedcomIndex, computeRelationships } = require('./relationships');
const { searchAllArchives } = require('./archives-search');

// ── GEDCOM cache ───────────────────────────────────────────────────────────────
const GEDCOM_MAP_FILE  = path.join(__dirname, 'gedcom-map.json');
const GEDCOM_DATA_FILE = path.join(__dirname, 'gedcom-data.json');
let _gedcomCache = null;

function loadGedcomCache() {
  if (_gedcomCache) return _gedcomCache;
  if (!fs.existsSync(GEDCOM_MAP_FILE) || !fs.existsSync(GEDCOM_DATA_FILE)) return null;
  try {
    const map  = JSON.parse(fs.readFileSync(GEDCOM_MAP_FILE,  'utf8'));
    const data = JSON.parse(fs.readFileSync(GEDCOM_DATA_FILE, 'utf8'));
    _gedcomCache = buildGedcomIndex(map, data);
    return _gedcomCache;
  } catch (err) {
    console.warn('Could not load GEDCOM data:', err.message);
    return null;
  }
}

const app = express();

// ── Multer ─────────────────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function makeDiskUploader(subdir) {
  const dir = path.join(__dirname, '../uploads', subdir);
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename:    (req, file, cb) => {
        const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
      },
    }),
    limits:     { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });
}
const uploadArchiveImage = makeDiskUploader('archives');
const uploadPersonPhoto  = makeDiskUploader('people');
const uploadSourceFile   = makeDiskUploader('sources');

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../client'), { index: false }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Email helper ───────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER) return; // email not configured, skip silently

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  // Use Resend HTTP API when configured — gives clearer errors than SMTP
  if (process.env.SMTP_HOST === 'smtp.resend.com') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SMTP_PASS}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.message || body.error || `Resend API error ${res.status}`;
      console.error('Resend send error:', msg);
      throw new Error(msg);
    }
    return;
  }

  // Fall back to nodemailer for other SMTP providers
  const nodemailer = require('nodemailer');
  const mailer = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.hostinger.com',
    port:   Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    await mailer.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error('Email send error:', err.message);
    throw err;
  }
}

// ── Auth routes (public) ───────────────────────────────────────────────────────

// Registration is admin-only during beta. Requires ADMIN_KEY env var in request header or body.
app.post('/api/auth/register', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  const providedKey = req.headers['x-admin-key'] || req.body.adminKey;
  if (!adminKey || providedKey !== adminKey)
    return res.status(403).json({ error: 'Registration is currently by invitation only.' });

  const { email, password, name, plan } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const existing = await db.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
    const passwordHash = await hashPassword(password);
    const user  = await db.createUser({ email, passwordHash, name, plan });
    const token = signToken({ userId: user.id, email: user.email });

    const appUrl = process.env.APP_URL || 'https://kriogriot.com';
    let emailSent = false;
    let emailError = null;

    if (process.env.SMTP_USER) {
      try {
        await sendEmail({
          to: user.email,
          subject: 'Welcome to Krio Griot — Your Account Is Ready',
          html: `
            <div style="font-family:ui-sans-serif,system-ui,sans-serif;background:#04223F;padding:32px 16px;min-height:100%">
              <div style="max-width:480px;margin:auto;background:#062F58;border-radius:10px;overflow:hidden;border:1px solid rgba(160,200,240,.18)">
                <div style="background:#062F58;padding:32px 32px 24px;text-align:center">
                  <div style="font-size:1.4rem;font-weight:700;color:#F0F6FC;letter-spacing:-.02em">Krio Griot</div>
                  <div style="font-size:.8rem;color:rgba(192,220,248,.45);margin-top:4px">Legacy Research &amp; Genealogy</div>
                </div>
                <div style="padding:0 32px 32px">
                  <h2 style="color:#EF9F27;font-size:1.15rem;margin:0 0 16px">Welcome, ${user.name || 'there'}.</h2>
                  <p style="color:rgba(240,246,252,.85);line-height:1.6;margin:0 0 12px">
                    Your Krio Griot account has been created. You now have access to the platform to begin building your family tree, logging your research, and preserving the stories that matter most.
                  </p>
                  <p style="color:rgba(240,246,252,.85);line-height:1.6;margin:0 0 24px">
                    This platform was built for us, by us — a private space for your lineage, your records, and your legacy.
                  </p>
                  <div style="background:rgba(0,0,0,.2);border-radius:6px;padding:16px;margin-bottom:24px">
                    <div style="color:rgba(192,220,248,.6);font-size:.78rem;margin-bottom:6px">YOUR LOGIN</div>
                    <div style="color:#F0F6FC;font-size:.9rem"><strong>Email:</strong> ${user.email}</div>
                    <div style="color:#F0F6FC;font-size:.9rem;margin-top:4px"><strong>Password:</strong> the one you were given when your account was set up</div>
                  </div>
                  <a href="${appUrl}/login" style="display:block;text-align:center;background:#EF9F27;color:#04223F;padding:13px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:.95rem;letter-spacing:.01em">Sign In to Krio Griot</a>
                  <p style="color:rgba(192,220,248,.3);font-size:.75rem;text-align:center;margin-top:20px;line-height:1.5">
                    If you were not expecting this email, you can ignore it.<br>Questions? Reply to <a href="mailto:support@kriogriot.com" style="color:#EF9F27">support@kriogriot.com</a>
                  </p>
                </div>
              </div>
            </div>
          `,
        });
        emailSent = true;
      } catch (err) {
        emailError = err.message;
        console.error('Welcome email failed:', err.message);
      }
    }

    res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan }, emailSent, emailError: emailError || (!process.env.SMTP_USER ? 'SMTP not configured' : null) });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  try {
    const user = await db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    const ok = await checkPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
    const token = signToken({ userId: user.id, email: user.email });
    res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => res.json({ ok: true }));

// ── SMTP diagnostic (admin-only, remove after confirming email works) ──────────
app.get('/smtp-test', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.headers['x-admin-key'] !== adminKey)
    return res.status(403).json({ error: 'Forbidden' });

  const cfg = {
    SMTP_HOST: process.env.SMTP_HOST || '(not set)',
    SMTP_PORT: process.env.SMTP_PORT || '(not set)',
    SMTP_USER: process.env.SMTP_USER || '(not set)',
    SMTP_PASS: process.env.SMTP_PASS ? '(set, hidden)' : '(not set)',
    SMTP_FROM: process.env.SMTP_FROM || '(not set)',
    APP_URL:   process.env.APP_URL   || '(not set)',
  };

  if (!process.env.SMTP_USER) return res.json({ ok: false, cfg, error: 'SMTP_USER not set' });

  try {
    if (process.env.SMTP_HOST === 'smtp.resend.com') {
      // For Resend, test the HTTP API directly — SMTP verify() passes even when domain is unverified
      const testRes = await fetch('https://api.resend.com/domains', {
        headers: { 'Authorization': `Bearer ${process.env.SMTP_PASS}` },
      });
      const data = await testRes.json().catch(() => ({}));
      if (!testRes.ok) throw new Error(data.message || `Resend API error ${testRes.status}`);
      const domains = (data.data || []).map(d => `${d.name} (${d.status})`);
      return res.json({ ok: true, cfg, message: 'Resend API key valid.', domains });
    }
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.hostinger.com',
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.verify();
    res.json({ ok: true, cfg, message: 'SMTP connection verified successfully.' });
  } catch (err) {
    res.json({ ok: false, cfg, error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const user = await db.getUserByEmail(email);
    if (!user) return res.json({ ok: true }); // don't reveal if email exists
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    await db.storeResetToken(user.id, token, expires);
    const appUrl   = process.env.APP_URL || 'https://kriogriot.com';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    // If SMTP is not configured, return the reset URL directly so admin can use it
    if (!process.env.SMTP_USER) {
      console.warn('SMTP not configured — returning reset URL in response');
      return res.json({ ok: true, resetUrl });
    }

    try {
      await sendEmail({
        to: user.email,
        subject: 'Krio Griot — Reset Your Password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
            <div style="margin-bottom:20px">
              <span style="font-size:1.2rem;font-weight:700;color:#EF9F27">Krio Griot</span>
            </div>
            <p style="color:#333;margin-bottom:12px">Hi ${user.name || 'there'},</p>
            <p style="color:#333;margin-bottom:24px">Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
            <p style="margin-bottom:24px">
              <a href="${resetUrl}" style="background:#EF9F27;color:#04223F;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block">Reset Password</a>
            </p>
            <p style="color:#888;font-size:0.82rem">If you did not request a password reset, you can ignore this email.</p>
          </div>
        `,
      });
      res.json({ ok: true });
    } catch (emailErr) {
      // Email failed — return the link directly so the user isn't stuck
      console.error('Reset email failed:', emailErr.message);
      res.json({ ok: true, resetUrl, emailError: emailErr.message });
    }
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  try {
    const record = await db.getResetToken(token);
    if (!record) return res.status(400).json({ error: 'Invalid or expired reset link.' });
    if (new Date(record.expires_at) < new Date()) {
      await db.clearResetToken(token);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }
    const passwordHash = await hashPassword(password);
    await db.updateUserPassword(record.user_id, passwordHash);
    await db.clearResetToken(token);
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health check (public) ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, anthropicKey: !!process.env.ANTHROPIC_API_KEY });
});

// ── Mango opt-in (public) ──────────────────────────────────────────────────────

const RECORD_AVAIL = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/record-availability.json'), 'utf8')
);

function getRecordMatches(state, era) {
  const stateDef = RECORD_AVAIL.states[state];
  if (!stateDef) return { items: RECORD_AVAIL.fallbackItems.slice(0, 8), fallback: true };
  const stateTags = new Set(stateDef.tags);
  if (stateTags.has('foreign') || stateTags.has('unknown'))
    return { items: RECORD_AVAIL.fallbackItems.slice(0, 8), fallback: true };

  const order = { documented: 0, absent: 1, inferred: 2 };
  const all = Object.values(RECORD_AVAIL.recordSets)
    .filter(rs => rs.tags.some(t => stateTags.has(t)) && (!era || rs.eras.includes(era)))
    .sort((a, b) => (order[a.grade] ?? 3) - (order[b.grade] ?? 3));

  const items = all.slice(0, 8).map(rs => ({ label: rs.label, note: rs.note, grade: rs.grade }));
  if (!items.length) return { items: RECORD_AVAIL.fallbackItems.slice(0, 8), fallback: true };
  return { items, fallback: false };
}

app.get('/api/record-availability', (req, res) => {
  res.json(getRecordMatches(req.query.state, req.query.era));
});

const _mangoRateMap = new Map();
function mangoRateOk(ip) {
  const now = Date.now(), window = 60 * 60 * 1000;
  const hits = (_mangoRateMap.get(ip) || []).filter(t => now - t < window);
  if (hits.length >= 5) return false;
  hits.push(now); _mangoRateMap.set(ip, hits); return true;
}

const MANGO_CONSENT_TEXT =
  'Send my Mango report to this number on WhatsApp. I understand my email may be used to follow up about my family research. No newsletters. No spam.';

app.post('/api/mango', async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const ua = (req.headers['user-agent'] || '').slice(0, 255);
  const { question, ancestor_name, state, era, email, phone_cc, phone,
          consent_delivery, consent_community, website } = req.body || {};

  if (website) return res.json({ ok: true }); // honeypot
  if (!mangoRateOk(ip)) return res.status(429).json({ error: 'Too many requests. Try again later.' });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200)
    return res.status(400).json({ error: 'A valid email address is required.' });
  if (!phone || (phone || '').replace(/\D/g, '').length < 7 || (phone || '').length > 40)
    return res.status(400).json({ error: 'A valid phone number is required.' });
  if (!consent_delivery)
    return res.status(400).json({ error: 'Consent to delivery is required.' });
  // state is optional and free-form — don't reject unknown values

  const clean = s => (s || '').trim().slice(0, 2000);
  const qTrim  = clean(question);
  const nmTrim = (ancestor_name || '').trim().slice(0, 200);
  const stTrim = (state || '').trim().slice(0, 60);
  const erTrim = (era   || '').trim().slice(0, 40);
  const ccTrim = (phone_cc || '+1').trim().slice(0, 8);
  const consentAt = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');

  try {
    const existing = await db.mangoFindByEmail(email);
    const fields = {
      question: qTrim, ancestor_name: nmTrim, state: stTrim, era: erTrim,
      phone_cc: ccTrim, phone, consent_delivery: consent_delivery ? 1 : 0,
      consent_community: consent_community ? 1 : 0,
      consent_text: MANGO_CONSENT_TEXT, consent_at: consentAt, ip, user_agent: ua,
    };
    let rowId;
    if (existing.length) { rowId = existing[0].id; await db.mangoUpdate(rowId, fields); }
    else { rowId = await db.mangoInsert({ ...fields, email }); }

    const notifyTo = process.env.NOTIFY_TO || 'emailme@aishaladon.com';
    const subject = `Mango request — ${nmTrim || 'no name given'} · ${stTrim || 'unknown state'}`;
    const body = `${qTrim || '(no question entered)'}

ANCESTOR   ${nmTrim || '(none)'}
PLACE      ${stTrim || '(none)'}
ERA        ${erTrim || '(none)'}

EMAIL      ${email}
WHATSAPP   ${ccTrim}${phone}

Community opt-in: ${consent_community ? 'yes' : 'no'}
Submitted:        ${consentAt}
Request #${rowId}`;

    sendEmail({ to: notifyTo, subject, html: `<pre style="font-family:monospace;font-size:14px;">${body}</pre>` })
      .catch(err => console.error('Mango notify email failed:', err.message));

    res.json({ ok: true, id: rowId });
  } catch (err) {
    console.error('Mango POST error:', err.message, err.stack);
    res.status(500).json({ error: 'Something went wrong. Please try again.', detail: err.message });
  }
});

// ── All routes below require auth ──────────────────────────────────────────────
app.use('/api', requireAuth);

// ── Internal search ────────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const term = req.query.q || '';
  if (term.trim().length < 2) return res.json([]);
  try {
    res.json(await db.searchAll(req.user.userId, term));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── External archive search ────────────────────────────────────────────────────
app.get('/api/archives-search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (query.length < 2) return res.json({ nara: [], slaveVoyages: [], enslaved: [], errors: [] });
  try {
    const results = await searchAllArchives(query, { limit: 10 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dashboard ──────────────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    res.json(await db.getDashboardCounts(req.user.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Ancestors ──────────────────────────────────────────────────────────────────
app.get('/api/ancestors', async (req, res) => {
  try {
    res.json(await db.getAllAncestors(req.user.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ancestor/:id', async (req, res) => {
  try {
    const profile = await db.getAncestorProfile(req.user.userId, req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found.' });
    const relationships = await getRelationshipsFor(req.user.userId, req.params.id);
    res.json({ ...profile, relationships });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ancestor/:id', async (req, res) => {
  try {
    await db.deletePerson(req.user.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/merge-ancestors', async (req, res) => {
  res.json({ ok: true, merged: {} });
});

// ── Relationships ──────────────────────────────────────────────────────────────
async function getRelationshipsFor(userId, recordId) {
  try {
    const gedcom = loadGedcomCache();
    const people = await db.getFamilyTreeData(userId);
    const peopleById = {};
    for (const p of (people || [])) peopleById[p.id] = p;

    const connections = await db.getFamilyConnections(userId);
    const overrides = {};
    for (const c of connections) {
      overrides[String(c.child_id)] = { fatherId: c.father_id ? String(c.father_id) : null, motherId: c.mother_id ? String(c.mother_id) : null };
    }

    return computeRelationships(recordId, peopleById, gedcom, overrides);
  } catch (err) {
    return { parents: [], spouses: [], children: [] };
  }
}

// ── Research Questions ─────────────────────────────────────────────────────────
app.get('/api/questions', async (req, res) => {
  try { res.json(await db.getAllQuestions(req.user.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Sources ────────────────────────────────────────────────────────────────────
app.get('/api/sources-all', async (req, res) => {
  try { res.json(await db.getAllSources(req.user.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sources/:ancestorId', async (req, res) => {
  try { res.json(await db.getAllSources(req.user.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Research Log ───────────────────────────────────────────────────────────────
app.get('/api/research-log', async (req, res) => {
  try { res.json(await db.getAllResearchLog(req.user.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DNA ────────────────────────────────────────────────────────────────────────
app.get('/api/dna-all', async (req, res) => {
  try {
    const [testing, matches] = await Promise.all([
      db.getAllDNATesting(req.user.userId),
      db.getAllDNAMatches(req.user.userId),
    ]);
    res.json({ testing, matches });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Archives ───────────────────────────────────────────────────────────────────
app.get('/api/archives', async (req, res) => {
  try { res.json(await db.getAllArchives(req.user.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Collections ────────────────────────────────────────────────────────────────
app.get('/api/collections', async (req, res) => {
  try { res.json(await db.getAllCollections(req.user.userId)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/archives-full', async (req, res) => {
  try {
    const [archives, collections] = await Promise.all([
      db.getAllArchives(req.user.userId),
      db.getAllCollections(req.user.userId),
    ]);
    res.json({ archives, collections });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Generic CRUD ───────────────────────────────────────────────────────────────
app.post('/api/record/:table', async (req, res) => {
  try {
    const record = await db.createAnyRecord(req.user.userId, req.params.table, req.body.fields);
    res.json({ ok: true, record });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/record/:table/:id', async (req, res) => {
  try {
    await db.updateAnyRecord(req.user.userId, req.params.table, req.params.id, req.body.fields);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/record/:table/:id', async (req, res) => {
  try {
    await db.deleteAnyRecord(req.user.userId, req.params.table, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/table-fields/:table', async (req, res) => {
  try { res.json(await db.getTableFields(req.params.table)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI Research ────────────────────────────────────────────────────────────────
app.post('/api/research', async (req, res) => {
  const { name, birthYear, location, relatives, questions, selectedCategories, locationFilters } = req.body;
  if (!name) return res.status(400).json({ error: 'Ancestor name is required.' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  try {
    await anthropic.runResearch(
      { name, birthYear, location, relatives, questions, selectedCategories, locationFilters },
      (chunk) => res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
    );
    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

app.post('/api/chat', async (req, res) => {
  const { history, message, selectedCategories } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });
  try {
    res.json(await anthropic.continueChat(history || [], message, selectedCategories));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Save findings ──────────────────────────────────────────────────────────────
app.post('/api/save-findings', async (req, res) => {
  const { sources = [], ancestors = [], questions = [], dnaMatches = [], ancestorId } = req.body;
  const saved = { sources: [], ancestors: [], questions: [], dnaMatches: [] };
  const uid = req.user.userId;
  try {
    for (const s of sources) { const r = await db.saveSource(uid, { ...s, ancestorId }); if (r) saved.sources.push(r); }
    for (const a of ancestors) { const r = await db.saveAncestor(uid, a); if (r) saved.ancestors.push(r); }
    for (const q of questions) { const r = await db.saveQuestion(uid, q); if (r) saved.questions.push(r); }
    for (const d of dnaMatches) { const r = await db.saveDNAMatch(uid, d); if (r) saved.dnaMatches.push(r); }
    res.json({ ok: true, saved });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/save-research-log', async (req, res) => {
  try {
    const record = await db.saveResearchLog(req.user.userId, req.body);
    res.json({ ok: true, record });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Metadata via Vision ────────────────────────────────────────────────────────
app.post('/api/metadata', upload.single('image'), async (req, res) => {
  try {
    let base64, mediaType;
    if (req.file) {
      base64 = req.file.buffer.toString('base64');
      mediaType = req.file.mimetype;
    } else if (req.body.base64) {
      const match = req.body.base64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) { mediaType = match[1]; base64 = match[2]; }
      else { base64 = req.body.base64; mediaType = 'image/jpeg'; }
    } else {
      return res.status(400).json({ error: 'No image provided.' });
    }
    const metadata = await anthropic.generateMetadata(base64, mediaType, req.body.standard || 'general');
    res.json(metadata);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── File uploads — NAS preferred, local disk fallback ─────────────────────────
async function handleUpload(req, res, localPath) {
  if (!req.file) return res.status(400).json({ error: 'No file provided.' });
  if (process.env.NAS_PASS) {
    try {
      const url = await uploadToNAS(req.file.filename, req.file.buffer, req.file.mimetype);
      return res.json({ ok: true, imageUrl: url, storage: 'nas' });
    } catch (err) {
      console.error('NAS upload failed, falling back to local:', err.message);
    }
  }
  res.json({ ok: true, imageUrl: localPath, storage: 'local' });
}

app.post('/api/upload-archive-image', upload.single('image'), async (req, res) => {
  await handleUpload(req, res, `/uploads/archives/${req.file?.filename}`);
});

app.post('/api/upload-person-photo', upload.single('image'), async (req, res) => {
  await handleUpload(req, res, `/uploads/people/${req.file?.filename}`);
});

app.post('/api/upload-source-file', upload.single('image'), async (req, res) => {
  await handleUpload(req, res, `/uploads/sources/${req.file?.filename}`);
});

app.post('/api/save-archive', async (req, res) => {
  try {
    const record = await db.saveArchive(req.user.userId, req.body);
    res.json({ ok: true, record });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Family Tree ────────────────────────────────────────────────────────────────
app.get('/api/family-tree', async (req, res) => {
  try {
    const people = await db.getFamilyTreeData(req.user.userId);
    res.json({ people, families: [], gedcomLoaded: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/family-tree/connect', async (req, res) => {
  try {
    const { childId, fatherId, motherId } = req.body || {};
    if (!childId) return res.status(400).json({ error: 'childId required' });
    if (!fatherId && !motherId) {
      await db.removeFamilyConnection(req.user.userId, childId);
    } else {
      await db.saveFamilyConnection(req.user.userId, { childId, fatherId, motherId });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/family-tree/connect/:childId', async (req, res) => {
  try {
    await db.removeFamilyConnection(req.user.userId, req.params.childId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/family-tree/reload', (req, res) => {
  _gedcomCache = null;
  res.json({ ok: true, gedcomLoaded: false });
});

// ── Mango admin ───────────────────────────────────────────────────────────────
app.patch('/api/mango/:id', async (req, res) => {
  const { status } = req.body || {};
  const allowed = ['new','researching','sent','no reply'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  try {
    await db.mangoSetStatus(req.params.id, status);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mango', requireAuth, async (req, res) => {
  try {
    const rows = await db.mangoList({ status: req.query.status, q: req.query.q });
    res.json({ ok: true, rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/admin/mango', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin-mango.html'));
});
app.get('/admin/create-user', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin-create-user.html'));
});

// ── Pages ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client/landing.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, '../client/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../client/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '../client/login.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, '../client/login.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, '../client/login.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/landing.html')));

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌿 Krio Griot server running at http://localhost:${PORT}`);
  console.log(`   Anthropic API key : ${process.env.ANTHROPIC_API_KEY ? '✓ loaded' : '✗ MISSING'}`);
  console.log(`   MySQL host        : ${process.env.MYSQL_HOST || 'localhost'}`);
  console.log(`   MySQL database    : ${process.env.MYSQL_DATABASE || '(not set)'}`);
  console.log(`   SMTP user         : ${process.env.SMTP_USER || '(not set — emails disabled)'}\n`);
});
