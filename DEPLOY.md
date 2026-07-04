# Deployment Guide — Legacy P&P BD Workspace

## Prerequisites on your web server
- Python 3.11+
- MySQL 5.7+ or MariaDB 10.4+
- A database and user already created for this app
- HTTPS certificate (Let's Encrypt or your host's SSL)

---

## Step 1 — Upload files

Upload the entire project to your server. A good path:
```
/home/yourusername/legacy-bd/
```

---

## Step 2 — Create the database

In your MySQL client (cPanel > phpMyAdmin, or command line):
```sql
CREATE DATABASE legacy_bd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'legacy_bd_user'@'localhost' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON legacy_bd.* TO 'legacy_bd_user'@'localhost';
FLUSH PRIVILEGES;
```

---

## Step 3 — Create and activate the virtual environment

```bash
cd /home/yourusername/legacy-bd
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Step 4 — Create your .env file

```bash
cp .env.example .env
nano .env   # fill in all values
```

Required values:
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SECRET_KEY` — generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- `ADMIN_USERNAME` and `ADMIN_PASSWORD` — your login credentials
- `IMAP_*` — your info@legacypnp.ltd mail server settings
- `SMTP_*` — outgoing mail settings for sending the digest

---

## Step 5 — Initialize the database

```bash
source venv/bin/activate
python init_db.py
```

This creates all 18 tables and loads:
- 12 NAICS codes
- 29 keywords
- 19 user settings
- 8 funders (IMLS, NEH, Cal Humanities, etc.)
- 9 data sources

---

## Step 6 — Deploy the web app

### Option A: cPanel with Passenger (most shared hosts)

1. In cPanel > Setup Python App, create a new app:
   - Python version: 3.11
   - Application root: `/home/yourusername/legacy-bd`
   - Application URL: your domain or subdomain (e.g. `bd.legacypnp.ltd`)
   - Application startup file: `wsgi.py`
   - Application Entry point: `application`

2. In the virtual environment for that app, install packages from requirements.txt

3. Restart the app via cPanel

### Option B: VPS with Gunicorn + Nginx

```bash
# Start gunicorn (test)
source venv/bin/activate
gunicorn --workers 2 --bind 0.0.0.0:5000 wsgi:application
```

Add a systemd service and Nginx reverse proxy to keep it running. (Details vary by server setup.)

---

## Step 7 — Install cron jobs

```bash
crontab -e
```

Paste the contents of `crontab.example` and update the paths to match your server.

---

## Step 8 — First login

Navigate to your domain/subdomain. Log in with the credentials you set in `.env`.

**Change your password** — the ADMIN_PASSWORD in `.env` is plain text. After your first login, update it in `.env` and restart the app.

---

## Logs directory (create it)

```bash
mkdir -p /home/yourusername/legacy-bd/logs
```

---

## Updating the app

```bash
# Upload new files, then:
source venv/bin/activate
pip install -r requirements.txt  # if requirements changed
python init_db.py                # safe to re-run; seed data uses INSERT IGNORE logic
# Restart the app via cPanel or: sudo systemctl restart legacy-bd
```
