require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const db = require('./config/database');

const SERVER_STARTED = new Date();
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'partials/layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SECRET_KEY || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(flash());

app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash_success = req.flash('success');
  res.locals.flash_error = req.flash('error');
  res.locals.flash_info = req.flash('info');
  res.locals.serverStarted = SERVER_STARTED;
  res.locals.companyLogo = null;
  try {
    const [[row]] = await db.query("SELECT value FROM user_settings WHERE name = 'company_logo_path'");
    if (row && row.value) res.locals.companyLogo = row.value;
  } catch (_) {
    // settings table not reachable yet (e.g. before first /setup run) — sidebar falls back to the default mark
  }

  // Dateline rail — the app-shell furniture from the redesign: today's date,
  // federal fiscal year/quarter, live pipeline value, and SAM.gov sync
  // freshness, rendered as a thin status line under the header on every page.
  res.locals.dateline = { pipelineValue: null, samSync: null };
  try {
    const [[pipelineRow]] = await db.query(
      "SELECT SUM(expected_value) AS total FROM pipeline WHERE stage NOT IN ('Awarded','Lost','Withdrawn')"
    );
    res.locals.dateline.pipelineValue = pipelineRow ? Number(pipelineRow.total) || 0 : null;

    const [[samRow]] = await db.query("SELECT last_checked FROM data_sources WHERE name = 'SAM.gov'");
    res.locals.dateline.samSync = samRow ? samRow.last_checked : null;
  } catch (_) {
    // pipeline/data_sources not reachable yet — rail just omits those fields
  }

  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/getting_started'));
app.use('/', require('./routes/dashboard'));
app.use('/opportunities', require('./routes/opportunities'));
app.use('/sam-search', require('./routes/sam_search'));
app.use('/grants-search', require('./routes/grants_search'));
app.use('/imls', require('./routes/imls'));
app.use('/usaspending', require('./routes/usaspending'));
app.use('/government', require('./routes/government'));
app.use('/grants', require('./routes/grants'));
app.use('/pipeline', require('./routes/pipeline'));
app.use('/projects', require('./routes/projects'));
app.use('/contacts', require('./routes/contacts'));
app.use('/institutions', require('./routes/institutions'));
app.use('/funders', require('./routes/funders'));
app.use('/award-history', require('./routes/award_history'));
app.use('/guides', require('./routes/guides'));
app.use('/settings', require('./routes/settings'));
app.use('/digest-log', require('./routes/digest_log'));
app.use('/email-inbox', require('./routes/email_inbox'));
app.use('/diagnostics', require('./routes/diagnostics'));
app.use('/', require('./routes/claude-chat'));
app.use('/', require('./routes/setup'));

require('./services/scheduler');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Legacy GovCon running on port ${PORT}`);
});

module.exports = app;
