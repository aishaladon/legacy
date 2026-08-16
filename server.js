require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const db = require('./config/database');

const SERVER_STARTED = new Date();
const app = express();

// An unhandled rejection in any async route handler (there's no global
// try/catch on route handlers in this app) crashes the entire Node process
// on Node 15+ by default — every user gets a 503 while it restarts, and any
// in-memory state (previously: sessions) is lost. These two handlers stop
// that: log the error and keep the process running instead of exiting, so
// one bad request can't take the whole app down for everyone.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (process kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (process kept alive):', err);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'partials/layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sessions persist in MySQL (not the default in-memory store) so a
// redeploy or process restart doesn't silently log everyone out — a bare
// MemoryStore loses every active session the moment the Node process
// restarts, which is exactly what a fresh-ZIP redeploy on Hostinger does.
const sessionStore = new MySQLStore({ createDatabaseTable: true }, db);
sessionStore.onReady().catch(err => {
  console.error('Session store failed to initialize, falling back to in-memory sessions:', err.message);
});

app.use(session({
  secret: process.env.SECRET_KEY || 'change-this-secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(flash());

app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
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

  // Sidebar record counts — one cheap COUNT per list-type nav item, all run
  // together so a single missing table can't take the others down with it.
  res.locals.navCounts = {};
  res.locals.ownerName = null;
  res.locals.companyNameShort = null;
  try {
    const [
      [[oppRow]], [[govRow]], [[grantRow]], [[pipeRow]], [[projRow]],
      [[awardRow]], [[instRow]], [[contactRow]], [[funderRow]], [[profileRows]]
    ] = await Promise.all([
      db.query('SELECT COUNT(*) AS c FROM opportunities'),
      db.query("SELECT COUNT(*) AS c FROM opportunities WHERE opportunity_type = 'Government Contract'"),
      db.query("SELECT COUNT(*) AS c FROM opportunities WHERE opportunity_type = 'Grant'"),
      db.query("SELECT COUNT(*) AS c FROM pipeline WHERE stage NOT IN ('Awarded','Lost','Withdrawn')"),
      db.query("SELECT COUNT(*) AS c FROM projects WHERE status = 'Active'"),
      db.query('SELECT COUNT(*) AS c FROM award_history'),
      db.query('SELECT COUNT(*) AS c FROM institutions WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM contacts WHERE is_active = 1'),
      db.query('SELECT COUNT(*) AS c FROM funders WHERE is_active = 1'),
      db.query("SELECT name, value FROM user_settings WHERE name IN ('company_owner_name','company_business_name')")
    ]);
    res.locals.navCounts = {
      opportunities: oppRow.c, government: govRow.c, grants: grantRow.c,
      pipeline: pipeRow.c, projects: projRow.c, awards: awardRow.c,
      institutions: instRow.c, contacts: contactRow.c, funders: funderRow.c
    };
    profileRows.forEach(r => {
      if (r.name === 'company_owner_name' && r.value) res.locals.ownerName = r.value;
      if (r.name === 'company_business_name' && r.value) res.locals.companyNameShort = r.value;
    });
  } catch (_) {
    // a table isn't reachable yet — sidebar just omits count badges
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

// Catch-all error handler — anything a route passes to next(err), or throws
// synchronously, ends up here with a normal error page instead of Express's
// default stack-trace dump (or, previously, an uncaught crash).
app.use((req, res) => {
  res.status(404).send('Not found.');
});
app.use((err, req, res, next) => {
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  if (res.headersSent) return next(err);
  res.status(500).send('Something went wrong loading this page. It has been logged — try again, or go back.');
});

require('./services/scheduler');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Legacy GovCon running on port ${PORT}`);
});

module.exports = app;
