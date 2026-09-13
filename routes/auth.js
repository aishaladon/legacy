const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { title: 'Log In', layout: false });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (username !== adminUser) {
    req.flash('error', 'Invalid credentials.');
    return res.redirect('/login');
  }

  let valid = false;
  if (adminPass && adminPass.startsWith('$2')) {
    valid = await bcrypt.compare(password, adminPass);
  } else {
    valid = password === adminPass;
  }

  if (!valid) {
    req.flash('error', 'Invalid credentials.');
    return res.redirect('/login');
  }

  req.session.user = { username: adminUser };
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
