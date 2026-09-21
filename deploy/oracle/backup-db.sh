#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CampusFlow — sauvegarde PostgreSQL (VM Oracle Cloud)
#
# Usage :
#   sudo bash deploy/oracle/backup-db.sh              # sauvegarde immédiate
#   sudo crontab -e                                   # sauvegarde quotidienne 03:00
#   0 3 * * * /bin/bash /opt/campusflow/deploy/oracle/backup-db.sh >> /var/log/campusflow/backup.log 2>&1
#
# Restauration (base vide) :
#   sudo -u postgres psql -c "CREATE DATABASE campusflow_restore OWNER campusflow;"
#   PGPASSWORD=<DB_PASSWORD> pg_restore -h 127.0.0.1 -U campusflow -d campusflow_restore \
#       --no-owner /var/backups/campusflow/campusflow-<date>.dump
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/campusflow}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/campusflow}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

ENV_FILE="${APP_DIR}/backend/.env"
[[ -f "${ENV_FILE}" ]] || { echo "Fichier ${ENV_FILE} introuvable." >&2; exit 1; }

DB_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | cut -d= -f2-)"
DB_NAME="${DB_URL##*/}"
DB_USER="${DB_URL#postgresql://}"; DB_USER="${DB_USER%%:*}"
DB_PASSWORD="${DB_URL#postgresql://${DB_USER}:}"; DB_PASSWORD="${DB_PASSWORD%%@*}"
DB_HOSTPORT="${DB_URL#*@}"; DB_HOST="${DB_HOSTPORT%%:*}"; DB_PORT="${DB_HOSTPORT#*:}"; DB_PORT="${DB_PORT%%/*}"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="${BACKUP_DIR}/campusflow-${STAMP}.dump"

PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" \
    -U "${DB_USER}" -d "${DB_NAME}" \
    --format=custom --compress=9 \
    --file="${FILE}"

echo "$(date -Is) sauvegarde OK → ${FILE} ($(du -h "${FILE}" | cut -f1))"

find "${BACKUP_DIR}" -name 'campusflow-*.dump' -type f -mtime "+${RETENTION_DAYS}" -delete
echo "$(date -Is) purge : sauvegardes de plus de ${RETENTION_DAYS} jours supprimées"
