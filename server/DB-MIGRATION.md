# Switching Krio Griot from Airtable to MySQL

The app now has a **pluggable data layer**. `index.js` talks to `server/db.js`, which
loads one of two backends based on an env var — so you can switch to MySQL and roll back
to Airtable instantly, with zero code changes.

```
server/
├── db.js          ← switch (reads DB_DRIVER)
├── airtable.js    ← original Airtable backend (unchanged)
└── db-mysql.js    ← new MySQL backend (same function names)
```

## To run on MySQL

1. **Import the data** (once): create a MySQL database in Hostinger and import
   `mysql-export/kriogriot_import.sql` via phpMyAdmin (see `mysql-export/README.md`).

2. **Set env vars** (hPanel → your Node app → Environment, or local `.env`):
   ```
   DB_DRIVER=mysql
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=your_db_user
   MYSQL_PASSWORD=your_db_password
   MYSQL_DATABASE=u123456789_kriogriot   # the full Hostinger name
   ```
   Leave `ANTHROPIC_API_KEY` set — the AI features still use it.

3. **Install deps & restart.** `mysql2` is already in `package.json`, so a redeploy
   (or `npm install`) picks it up. Restart the app.

4. **Verify:** `DB_DRIVER=mysql npm run db:test` prints connection status, row counts,
   and a profile smoke-test.

To go back to Airtable, set `DB_DRIVER=airtable` (or remove it) and restart.

## What changed vs Airtable — read this

- **Relationships resolve by name.** Airtable linked records by internal ID; the MySQL
  export stored the linked **names**. So "everything linked to this person" is matched on
  the person's name. Works well for your data; just be aware two people with the identical
  full name would share links.
- **The working `people` table is the curated 7**, per your earlier choice. The full 2,770
  GEDCOM rows live in `people_tree_archive` and are **not** used by the app (reference only).
- **Writes generate a new `record_id`** (Airtable-style `rec…`) for new rows.
- Everything else — dashboards, search, profiles, CRUD, family tree — maps 1:1 to the old
  behavior.

> Not yet tested against a live MySQL server (there wasn't one available while building).
> The code passes syntax checks and a field→column parity check across all 11 tables; run
> `npm run db:test` after import to confirm end-to-end, and send me any error it prints.
