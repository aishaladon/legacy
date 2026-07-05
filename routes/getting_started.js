const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/auth');

router.get('/getting-started', requireLogin, (req, res) => {
  res.render('getting_started/index', { title: 'Getting Started' });
});

module.exports = router;
