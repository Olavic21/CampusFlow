#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CampusFlow — sauvegarde de la base SQLite (Oracle Cloud VM)
#
# La copie est réalisée avec l'API de sauvegarde de SQLite (instantané
# transactionnel) : elle reste COHÉRENTE même si l'API écrit pendant l'opération
# (mode WAL inclus) — contrairement à un simple `cp` du fichier.
#
# Usage :
#   sudo bash /opt/campusflow/deploy/oracle/backup-db.sh      # sauvegarde immédiate
#
# Sauvegarde quotidienne à 03:00 (crontab root) :
#   0 3 * * * /bin/bash /opt/campusflow/deploy/oracle/backup-db.sh >> /var/log/campusflow/backup.log 2>&1
#
# Restauration : voir docs/DEPLOIEMENT.md § « Restauration SQLite ».
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/campusflow}"
ENV_FILE="${APP_DIR}/backend/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/campusflow}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
UTIL="${APP_DIR}/deploy/oracle/sqlite_util.py"
PYTHON="${PYTHON:-${APP_DIR}/.venv/bin/python}"
[[ -x "${PYTHON}" ]] || PYTHON="python3"

log()  { printf '\033[1;34m[backup]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error ]\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f "${ENV_FILE}" ]] || die "Fichier ${ENV_FILE} introuvable."
[[ -f "${UTIL}" ]] || die "Outil introuvable : ${UTIL}"

# DATABASE_URL=sqlite:////var/lib/campusflow/campusflow.db → /var/lib/campusflow/campusflow.db
DB_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | head -n1 | cut -d= -f2-)"
case "${DB_URL}" in
    sqlite:////*) DB_FILE="/${DB_URL#sqlite:////}" ;;
    *) die "DATABASE_URL n'est pas un chemin SQLite absolu (attendu sqlite:////... ), valeur lue : ${DB_URL}" ;;
esac
[[ -f "${DB_FILE}" ]] || die "Base introuvable : ${DB_FILE}"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_DIR}/campusflow-${STAMP}.db"

log "Sauvegarde cohérente : ${DB_FILE} → ${DEST}"
"${PYTHON}" "${UTIL}" backup "${DB_FILE}" "${DEST}" || die "Échec de la sauvegarde."

ROWS="$("${PYTHON}" "${UTIL}" count "${DEST}" locations 2>/dev/null || echo '?')"
log "Contenu de la sauvegarde : ${ROWS} bâtiments"

log "Rotation : suppression des sauvegardes de plus de ${RETENTION_DAYS} jours"
"${PYTHON}" "${UTIL}" prune "${BACKUP_DIR}" "${RETENTION_DAYS}"

log "Sauvegardes disponibles :"
ls -1sh "${BACKUP_DIR}"/campusflow-*.db 2>/dev/null | sed 's/^/    /' || true
