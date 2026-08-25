// ─────────────────────────────────────────────────────────────────────────────
// db.js — data-layer switch.
// Chooses the backend by the DB_DRIVER env var (default: mysql).
//   DB_DRIVER=mysql     → server/db-mysql.js  (MySQL / Hostinger) — current backend
//   DB_DRIVER=airtable  → server/airtable.js  (Airtable REST API) — legacy
// index.js requires THIS file, so flipping the env var swaps the backend with
// zero code changes and lets you roll back instantly.
// ─────────────────────────────────────────────────────────────────────────────
const driver = (process.env.DB_DRIVER || 'mysql').toLowerCase();
const backend = driver === 'mysql' ? require('./db-mysql') : require('./airtable');
console.log(`🗄  Data driver: ${driver}`);
module.exports = backend;
