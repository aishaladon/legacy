# Deployment Guide — Legacy GovCon (Node.js)

## Prerequisites on your web server
- Node.js 18+ and npm
- MySQL 5.7+ or MariaDB 10.4+
- A database and user already created for this app
- HTTPS certificate (Let's Encrypt or your host's SSL)

This app is a standard Express/Node.js application. On Hostinger, use the
**Node.js App** section of hPanel (not the Python App section).

---

## Step 1 — Upload files

Upload the entire project to your Node.js app's directory, either via Git or
by uploading a zip and extracting it. Do not upload your local `node_modules`
or `.env` — those are excluded below.

When zipping locally for upload:
```bash
zip -r legacy-update.zip . -x "node_modules/*" ".git/*" ".env*" "*.log"
```

---

## Step 2 — Create the database

In your MySQL client (Hostinger's hPanel > Databases, or phpMyAdmin):
```sql
CREATE DATABASE legacy_govcon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'legacy_user'@'localhost' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON legacy_govcon.* TO 'legacy_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## Step 3 — Install dependencies

```bash
cd /path/to/your/app
npm install
```

---

## Step 4 — Create your .env file

```bash
cp .env.example .env
nano .env   # fill in all values
```

Required values:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SECRET_KEY` — generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` — your login credentials
- `IMAP_*` — your info@legacypnp.ltd mail server settings (for Email Inbox sync)
- `SMTP_*` — outgoing mail settings for sending the digest
- `SAM_API_KEY` — free key from sam.gov, needed for SAM.gov Search and the
  daily SAM.gov automation
- `PORT` — the port your Node.js host expects the app to listen on (Hostinger
  sets this automatically; do not hard-code it)

The **Claude API key is not set here** — it's entered in-app under
**Settings → API Keys** and stored in the database.

---

## Step 5 — Initialize the database

```bash
node init_db.js
```

This is safe to re-run — seed data uses `INSERT IGNORE` and will skip rows
that already exist. It creates all tables from `database/schema.sql` and
seeds:
- NAICS codes, keywords, funders, data sources
- Default user settings

---

## Step 6 — Configure the Node.js app on Hostinger

1. In hPanel > **Node.js**, create or edit your application:
   - Application root: the folder you uploaded the project to
   - Application startup file: `server.js`
   - Node.js version: 18 or newer
2. Set the environment variables from your `.env` file in the Hostinger
   Node.js app's **Environment Variables** panel (Hostinger does not read
   `.env` files automatically for every setup — check whether your plan
   loads `.env` or requires variables to be set in the panel).
3. Click **Run NPM Install** (or run `npm install` via the app's terminal).
4. **Restart** the application from the Node.js panel.

---

## Step 7 — Scheduled automation (already built in — no crontab needed)

Unlike a typical Python deployment, this app's daily automation runs
**inside the Node.js process itself** via `node-cron`
(see `services/scheduler.js`). As long as the app is running, it will:
- Pull new SAM.gov opportunities daily at 7:00 AM server time (if
  `SAM_API_KEY` is set and the toggle is enabled in Settings → Automations)
- Pull new Grants.gov opportunities daily at 7:00 AM server time (if enabled)
- Email a Daily Opportunity Digest at the time set in Settings → General →
  "Time to send digest" (if `SMTP_HOST`/`SMTP_USERNAME`/`SMTP_PASSWORD` are
  set and the toggle is enabled in Settings → Automations) — logged to the
  Digest Log page (`/digest-log`) every time it runs, sent or not

You do **not** need to configure an OS-level crontab for this. The only
recommended crontab entry is an optional database backup — see
`crontab.example`.

---

## Step 8 — First login

Navigate to your domain. Log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD`
you set in `.env`.

**Change your password** by updating `ADMIN_PASSWORD` in your environment
variables and restarting the app. For a hashed password instead of plain
text, set `ADMIN_PASSWORD` to a bcrypt hash (starting with `$2`) — the app
detects this automatically and verifies with bcrypt instead of a plain
string comparison.

---

## Updating the app

```bash
# Upload new files (or git pull), then:
npm install       # if package.json changed
node init_db.js   # safe to re-run
# Restart the app from the Hostinger Node.js panel
```

After deploying, hard-refresh your browser (Ctrl+Shift+R / Cmd+Shift+R) to
make sure you're not seeing a cached copy of the old frontend JavaScript.
