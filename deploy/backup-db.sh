#!/bin/sh
# Respaldo diario de la base de Neon en el VPS (formato custom de pg_dump, restaurable con pg_restore).
# Complementa el historial corto del plan gratuito de Neon. Se programa con cron; ver docs/deploy-vps.md.
set -eu

cd "$(dirname "$0")"
set -a
. ./.env
set +a

backup_dir="${BACKUP_DIR:-/var/backups/academy}"
retention_days="${BACKUP_RETENTION_DAYS:-30}"
file="academy-$(date -u +%Y%m%dT%H%M%SZ).dump"

mkdir -p "$backup_dir"

# Cliente de PostgreSQL más nuevo que el servidor: pg_dump puede leer versiones anteriores.
docker run --rm \
  -e DIRECT_URL \
  -v "$backup_dir:/backups" \
  postgres:18-alpine \
  sh -c "pg_dump --format=custom --no-owner --dbname=\"\$DIRECT_URL\" --file=/backups/$file.partial \
    && mv /backups/$file.partial /backups/$file"

find "$backup_dir" -name 'academy-*.dump' -mtime +"$retention_days" -delete

echo "Respaldo creado: $backup_dir/$file"
