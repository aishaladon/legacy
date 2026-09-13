# Legacy GovCon — Project Memory

Read this before making changes. It captures operational knowledge that isn't
obvious from the code alone — hosting quirks, recurring bug patterns, and
conventions established across a long iterative build. `DEPLOY.md` covers the
step-by-step deploy process; this file covers the *why* and the traps.

## What this app is

A single-admin business-development tracking web app for **Legacy Planning &
Preservation Ltd.**, a government-contracting/grants/freelance consultancy in
archival management, digitization, records management, and museum/library
preservation. It tracks every paying opportunity in that field — federal/state
contracts, grants, freelance gigs (e.g. ArchiveGig postings) — through a
pipeline from discovery to award, plus the institutions, contacts, and past
performance behind them. See `PORTFOLIO.md` for the full feature tour and
`USER_GUIDE.md` for day-to-day workflow.

**Owner/sole user:** Aisha LaDon Abdul Rahman (Legacy Planning & Preservation
Ltd., Roseville, CA — WOSB/EDWOSB/MBE, CAGE 9XVN3, UEI W9MNGXEFKBS9).
Multi-user/role-based access was explicitly deferred by the owner's own
decision — do not build it without her asking again.

## Stack

Node.js / Express / EJS (server-rendered, no frontend framework) / MySQL
(`mysql2/promise`) / vanilla CSS. Deployed on **Hostinger** Node.js hosting at
`govcon.legacypnp.ltd`.

## The #1 hosting gotcha — deploys are NOT automatic

Hostinger's Node.js hosting does **not** pull new commits automatically and
does **not** reliably pick up changes from "Use previous files" / a plain
restart. Every code change requires the user to do a **fresh ZIP upload**
("Upload new files") and restart the app from Hostinger's panel. If the user
reports a fix "not working," the first question is always: *did you redeploy
with a fresh ZIP since that commit?* This has been the explanation for
several apparent "bugs" that were actually just stale deployments.

When `package.json` changes, `npm install` must also be re-run on the host
(via the Node.js panel's "Run NPM Install" or its terminal).

## Database setup/migrations — `/setup?key=...`

Schema and seed changes don't apply themselves. `routes/setup.js` (behind
`SETUP_KEY`, defaults to `legacy-setup-2026` if that env var isn't set —
recommend the owner set a real one) applies `database/schema.sql`, seeds
starter data, and runs the accumulated one-off migrations in
`database/migrations/`. **It is idempotent and safe to re-run anytime** —
`CREATE TABLE IF NOT EXISTS` / `INSERT IGNORE` throughout, never touches or
deletes the user's actual records (opportunities, institutions, contacts,
projects, communications, awards).

**Known trap:** a brand-new table added to `schema.sql` (e.g. `communications`)
does **not** exist on the live database until `/setup` is hit — and forgetting
this caused a real production outage this session (every Institution/Contact
detail page failed with `Table 'communications' doesn't exist` for an unknown
number of days, only surfacing as vague 503s/hangs until proper error
handling was added). **Prefer self-provisioning tables over relying on
`/setup`**: put `db.query('CREATE TABLE IF NOT EXISTS ...').catch(() => {})`
at the top of the route file that needs it (see `routes/contacts.js`,
`routes/institutions.js`, `routes/email_inbox.js`, `routes/settings.js` for
the pattern) so a missing table self-heals on the next server start instead
of depending on a manual step the owner has to remember.

## Recurring bug pattern: bare `UPDATE` on settings

`user_settings` rows may not exist yet on an install that hasn't re-run
`/setup` since a given setting was introduced. A plain
`UPDATE user_settings SET value=? WHERE name=?` silently succeeds with zero
rows affected in that case — no error, but nothing is saved, and the UI often
still shows a false "Saved" flash. **Always upsert**:
```sql
INSERT INTO user_settings (name, value, setting_type, description)
VALUES (?,?,?,?)
ON DUPLICATE KEY UPDATE value = VALUES(value), setting_type = VALUES(setting_type), description = VALUES(description)
```
(Re-writing `setting_type`/`description` on conflict too, not just `value` —
a setting stuck with a stale `setting_type` from before a UI reorg will
otherwise stay invisible in its new location forever. See the
`upsertSetting()` helper in `routes/settings.js`.) When *querying* settings
that are meant to live in a specific UI section, prefer filtering by a known
list of **names**, not by `setting_type` — the type on an existing row can be
stale even after the upsert fix ships, until that row is actually re-saved.

## Error handling

- `express-async-errors` is required at the very top of `server.js`, before
  any router is defined — it forwards a rejected promise from any async route
  handler to the catch-all error middleware automatically. **Without this,
  Express 4 leaves a failing request hanging forever with no response sent**
  (an infinite spinner), which is worse than the crash it replaced.
- Process-level `unhandledRejection`/`uncaughtException` handlers in
  `server.js` log and keep the process alive instead of exiting — this app's
  ~20 route files don't individually wrap every async handler, so one bad
  query used to be able to crash the *entire* server for every request,
  showing as a 503 until the process restarted (and, before sessions were
  made persistent, silently logging everyone out too).
- The catch-all error handler currently **shows the real error message** on
  a 500 page (not a generic "something went wrong"). This is intentional and
  currently considered safe: the app has exactly one authenticated user
  behind a login wall. If that ever changes (multi-user), revert this to a
  generic message first.

## Sessions

`express-mysql-session` (backed by the existing pool) — sessions persist in
MySQL, not memory. This matters because every redeploy restarts the Node
process; a bare in-memory session store would silently log the user out on
every single deploy, which is indistinguishable from a real bug to someone
testing rapidly.

## SAM.gov connectivity

Hostinger cannot reach `api.sam.gov` directly (confirmed via
`/diagnostics/network-check`, which tests the real endpoint+path, not just
the bare domain — testing the bare domain gives a false "Failed" reading).
SAM.gov search and the daily digest route through a **Cloudflare Worker
relay** instead (`SAM_RELAY_URL`/`SAM_RELAY_SECRET` env vars; see
`RELAY.md`). The diagnostics page shows the direct-connection row as
"Blocked (expected)" rather than a red failure — this is permanent, not a
bug to chase.

## Design system

Two intentionally distinct palettes, per the owner's explicit direction:
- **Sidebar/brand chrome**: navy/gold (`--navy-*`, `--gold-*` tokens in
  `public/css/main.css`), matching a specific mockup she approved. Icons are
  small inline SVGs defined in `views/partials/sidebar.ejs`.
- **Content area**: the "Broadsheet" system from
  `design_handoff_legacy_govcon/` — Source Serif 4 typography, cyan
  (interactive) / magenta (urgent/cold) accents on a paper/ink base,
  near-square 2px radii, flat surface fills instead of bordered boxes. Legacy
  CSS variable names (`--brand`, `--accent`, etc.) are remapped onto these
  tokens rather than renamed everywhere, so old view files keep working.
- Content area has **no max-width** (full-width layout, by explicit request)
  — watch for any new full-page component (like the Claude Assistant panel
  was) still carrying an old fixed `max-width` from before that change.

## Linked-record philosophy

The owner explicitly decided **against** merging Institutions/Contacts/
Projects into one unified view, after noting that many institutions have no
contact yet and many institutions/contacts have no project yet. Keep them as
three separate list pages/sidebar entries. Instead, each detail page surfaces
what's linked from the others (Institution → its Contacts/Projects/
Opportunities/Communications; Contact → its Institution/Projects/
Communications; Project → its Institution/Contacts/Pipeline stage), with a
plain "none yet" message rather than hiding the section or erroring — never
force a link that doesn't exist. Contacts now **require** an institution
(enforced both client- and server-side); institutions do not require a
contact.

## Known open questions / deferred work

- **Whether Hostinger keeps the Node process alive continuously** enough for
  `node-cron` scheduled jobs (daily digest, SAM/Grants pulls, scheduled
  backups) to reliably fire is unresolved. If a scheduled feature seems to
  "just not run" some days, this is the first thing to suspect — it's a
  hosting question, not something fixable in app code.
- **Multi-tenant / multi-user** — explicitly deferred by the owner. Do not
  design or build toward this without a fresh, explicit request.
- Backup/restore (`services/backupService.js`) and several peripheral
  features (SAM.gov Search, Grants.gov Search, USASpending, IMLS Awards,
  Claude Assistant) have not had the same intensive testing pass as
  Opportunities/Institutions/Contacts/Projects/Settings — treat as
  plausible-but-unverified rather than battle-tested.

## File map (non-obvious pieces)

- `services/backupService.js` — pure-JS/SQL DB dump (no `mysqldump` shell-out,
  uncertain availability on Hostinger), zipped via `archiver`, instant
  download or scheduled email.
- `utils/companyProfile.js` — single source of truth for company info fed
  into AI prompts (name, CAGE, UEI, certs, NAICS, capability statement).
- `utils/parseJsonLoose.js` — forgiving JSON parser for Claude responses
  (strips markdown fences) — use this, not bare `JSON.parse`, for any new
  Claude call expecting structured JSON back.
- `routes/diagnostics.js` — `/diagnostics/network-check`, tests real outbound
  connectivity per target, not synthetic.
- `company_assets` table — logo stored as a DB blob
  (`GET /settings/logo-image`), specifically *not* on local disk, because
  anything written to disk at runtime is wiped by the next fresh-ZIP
  redeploy.
