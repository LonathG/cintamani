#!/usr/bin/env bash
# Nightly backup of the Cintamani database and payment slips; keeps the last 14 days.
# Run by cron as root (see deploy/README.md). Touches nothing but Cintamani's own data.
set -euo pipefail

DB_NAME="cintamani"
SLIP_DIR="/var/lib/cintamani/slips"
OUT="/var/backups/cintamani"
KEEP_DAYS=14
DAY="$(date +%F)"

mkdir -p "$OUT"
chmod 700 "$OUT"

# database (custom format: restore with pg_restore)
runuser -u postgres -- pg_dump -Fc "$DB_NAME" > "$OUT/db-$DAY.dump.tmp"
mv "$OUT/db-$DAY.dump.tmp" "$OUT/db-$DAY.dump"

# payment slips
tar -czf "$OUT/slips-$DAY.tar.gz.tmp" -C "$(dirname "$SLIP_DIR")" "$(basename "$SLIP_DIR")"
mv "$OUT/slips-$DAY.tar.gz.tmp" "$OUT/slips-$DAY.tar.gz"

chmod 600 "$OUT"/*
find "$OUT" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'slips-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') backup ok: $(du -sh "$OUT" | cut -f1) in $OUT"
