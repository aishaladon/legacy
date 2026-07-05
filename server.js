require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

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

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash_success = req.flash('success');
  res.locals.flash_error = req.flash('error');
  res.locals.flash_info = req.flash('info');
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/opportunities', require('./routes/opportunities'));
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Legacy GovCon running on port ${PORT}`);
});

module.exports = app;
