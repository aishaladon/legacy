const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

// Real cross-entity search backing the header search box (placeholder:
// "Search notices, agencies, NAICS, contacts…"). Previously that form
// submitted straight to /opportunities?q=, which only ever searched
// opportunity fields — a search for a contact's or institution's name
// silently returned zero results. This queries every entity the placeholder
// promises in parallel and groups the results by type.
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  let results = { opportunities: [], institutions: [], contacts: [], funders: [] };

  if (q) {
    const like = `%${q}%`;

    const [
      [opportunities], [institutions], [contacts], [funders]
    ] = await Promise.all([
      db.query(`
        SELECT o.id, o.title, o.opportunity_type, o.status, o.due_date,
               i.name AS institution_name, gc.agency, gc.naics_code
        FROM opportunities o
        LEFT JOIN institutions i ON o.institution_id = i.id
        LEFT JOIN government_contracts gc ON gc.opportunity_id = o.id
        WHERE o.title LIKE ? OR o.description LIKE ? OR o.source LIKE ?
           OR gc.agency LIKE ? OR gc.naics_code LIKE ?
        ORDER BY o.due_date ASC, o.created_at DESC
        LIMIT 25
      `, [like, like, like, like, like]),
      db.query(`
        SELECT id, name, institution_type, relationship_status, city, state
        FROM institutions
        WHERE name LIKE ? OR city LIKE ? OR notes LIKE ?
        ORDER BY name
        LIMIT 25
      `, [like, like, like]),
      db.query(`
        SELECT c.id, c.first_name, c.last_name, c.title, c.email, i.name AS institution_name
        FROM contacts c
        LEFT JOIN institutions i ON c.institution_id = i.id
        WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.title LIKE ? OR c.email LIKE ?
        ORDER BY c.last_name
        LIMIT 25
      `, [like, like, like, like]),
      db.query(`
        SELECT id, name, funder_type
        FROM funders
        WHERE name LIKE ?
        ORDER BY name
        LIMIT 25
      `, [like])
    ]);

    results = { opportunities, institutions, contacts, funders };
  }

  const total = results.opportunities.length + results.institutions.length
    + results.contacts.length + results.funders.length;

  res.render('search/index', { title: 'Search', q, results, total });
});

module.exports = router;
