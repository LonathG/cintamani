# Deploying Cintamani on the VPS

The VPS (srv1451613, Hostinger) also hosts other companies' sites. Only touch Cintamani's own
files, database and nginx site, and **always run `nginx -t` before reloading nginx**.

| What | Where |
|---|---|
| Code (git clone of `main`) | `/var/www/cintamaniceylon.com` |
| Website files nginx serves | `/var/www/cintamaniceylon.com/frontend_assets` |
| Settings (secrets) | `/var/www/cintamaniceylon.com/.env` (not public, `chmod 600`) |
| Orders, customers, activity log | PostgreSQL database `cintamani` (user `cintamani`) |
| Payment slips | `/var/lib/cintamani/slips` (private, outside the website) |
| Order API | pm2 app `cintamani-api` → `127.0.0.1:8888` |
| nginx site | `/etc/nginx/sites-available/cintamaniceylon.com` (copy of `deploy/nginx-cintamaniceylon.conf`) |
| Admin extra password | `/etc/nginx/cintamani-admin.htpasswd` |
| Nightly backups | `/var/backups/cintamani` (14 days) |

All commands run as `root` in the Hostinger browser terminal. Paste one step at a time and check its result.

## First-time setup

**0. Snapshot.** In hPanel → VPS → Snapshot & backups, make sure a recent snapshot exists.

**1. Get the code and install**
```bash
cd /var/www/cintamaniceylon.com && git pull && npm ci --omit=dev
```

**2. Database + slip folder + settings.** Asks for the admin's sign-in email and password (typing the
password shows nothing). Database password and secrets are generated automatically.
```bash
cd /var/www/cintamaniceylon.com && read -p "Admin email: " AE && read -s -p "Admin password: " AP && echo && DBPASS=$(openssl rand -hex 24) && runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE cintamani LOGIN PASSWORD '$DBPASS';" -c "CREATE DATABASE cintamani OWNER cintamani ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8';" && mkdir -p /var/lib/cintamani/slips && chmod 700 /var/lib/cintamani /var/lib/cintamani/slips && printf 'PORT=8888\nHOST=127.0.0.1\nDATABASE_URL=postgres://cintamani:%s@127.0.0.1:5432/cintamani\nSLIP_DIR=/var/lib/cintamani/slips\nADMIN_EMAIL=%s\nADMIN_PASSWORD=%s\nADMIN_TOKEN_SECRET=%s\nCUSTOMER_TOKEN_SECRET=%s\n' "$DBPASS" "$AE" "$AP" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env && chmod 600 .env && unset AP DBPASS && echo "Saved: $(cut -d= -f1 .env | tr '\n' ' ')"
```
Expected last line: `Saved: PORT HOST DATABASE_URL SLIP_DIR ADMIN_EMAIL ADMIN_PASSWORD ADMIN_TOKEN_SECRET CUSTOMER_TOKEN_SECRET`

**3. Start the order API** (it creates its tables on first use)
```bash
cd /var/www/cintamaniceylon.com && pm2 start scripts/dev-server.mjs --name cintamani-api && pm2 save && sleep 2 && curl -s http://127.0.0.1:8888/api/account/me
```
Expected: `{"error":"Please sign in again."}` — the API is up and answering.
If pm2 says the name is already in use (started earlier), run instead:
`pm2 restart cintamani-api --update-env && pm2 save`

**4. Extra password for /admin** (a second lock in front of the admin page; pick a username + password,
different from the admin sign-in)
```bash
read -p "Admin page username: " BU && read -s -p "Admin page password: " BP && echo && printf '%s:%s\n' "$BU" "$(openssl passwd -apr1 "$BP")" > /etc/nginx/cintamani-admin.htpasswd && chown root:www-data /etc/nginx/cintamani-admin.htpasswd && chmod 640 /etc/nginx/cintamani-admin.htpasswd && unset BP && echo saved
```

**5. nginx: clean addresses, redirects, API, admin lock.** Keeps a copy of the current config and only
reloads if the test passes; otherwise it puts the old one back.
```bash
cp /etc/nginx/sites-available/cintamaniceylon.com /root/cintamaniceylon.com.nginx.bak && cp /var/www/cintamaniceylon.com/deploy/nginx-cintamaniceylon.conf /etc/nginx/sites-available/cintamaniceylon.com && if nginx -t; then systemctl reload nginx && echo "nginx reloaded"; else cp /root/cintamaniceylon.com.nginx.bak /etc/nginx/sites-available/cintamaniceylon.com && echo "TEST FAILED - old config restored, nothing changed"; fi
```

**6. Nightly backups at 02:30 (and one now)**
```bash
chmod +x /var/www/cintamaniceylon.com/deploy/backup.sh && echo '30 2 * * * root /var/www/cintamaniceylon.com/deploy/backup.sh >> /var/log/cintamani-backup.log 2>&1' > /etc/cron.d/cintamani-backup && /var/www/cintamaniceylon.com/deploy/backup.sh
```

## Checks
```bash
for u in / /about /about.html /art/u-1.html /collection/seetha-dress /admin /api/account/me; do printf '%-26s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' https://cintamaniceylon.com$u)"; done
```
Expected: `/` 200, `/about` 200, `/about.html` 301 → /about, `/art/u-1.html` 301 → /collection/seetha-dress,
`/collection/seetha-dress` 200, `/admin` 401 (asks for the extra password), `/api/account/me` 401.

## Updating the site later
```bash
cd /var/www/cintamaniceylon.com && git pull && npm ci --omit=dev && pm2 restart cintamani-api
```
If `deploy/nginx-cintamaniceylon.conf` changed, repeat step 5.

## Restoring from a backup
```bash
runuser -u postgres -- pg_restore --clean --if-exists -d cintamani /var/backups/cintamani/db-YYYY-MM-DD.dump
tar -xzf /var/backups/cintamani/slips-YYYY-MM-DD.tar.gz -C /var/lib/cintamani
```

## Moving existing file-storage data in (optional)
Orders saved as files (a `.data/` folder) can be copied into the database:
```bash
cd /var/www/cintamaniceylon.com && set -a && . ./.env && set +a && node scripts/import-data.mjs /path/to/.data
```
