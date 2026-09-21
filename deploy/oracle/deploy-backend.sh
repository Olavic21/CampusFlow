#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CampusFlow — mise à jour du backend en production (VM Oracle Cloud)
#
# Usage (en root) : sudo bash /opt/campusflow/deploy/oracle/deploy-backend.sh
#   GIT_REF=main      branche à déployer
#   SKIP_GIT=1        ne pas faire de git pull (déploiement d'un code déjà copié)
#
# Séquence : git pull → dépendances → migrations → seed éventuel → restart → test
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/campusflow}"
APP_USER="${APP_USER:-campusflow}"
SERVICE="${SERVICE:-campusflow-api}"
GIT_REF="${GIT_REF:-main}"
SKIP_GIT="${SKIP_GIT:-0}"

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn  ]\033[0m %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "À lancer en root (sudo)." >&2; exit 1; }

cd "${APP_DIR}"

if [[ "${SKIP_GIT}" != "1" ]]; then
    log "Récupération du code (branche ${GIT_REF})..."
    sudo -u "${APP_USER}" git fetch --prune origin
    sudo -u "${APP_USER}" git checkout "${GIT_REF}"
    sudo -u "${APP_USER}" git reset --hard "origin/${GIT_REF}"
fi

log "Installation / mise à jour des dépendances Python..."
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install --quiet --upgrade pip wheel
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install --quiet -r "${APP_DIR}/backend/requirements.txt"

log "Application du schéma PostgreSQL (idempotent)..."
DB_URL="$(grep -E '^DATABASE_URL=' "${APP_DIR}/backend/.env" | cut -d= -f2-)"
DB_NAME="${DB_URL##*/}"
DB_USER="${DB_URL#postgresql://}"; DB_USER="${DB_USER%%:*}"
DB_PASSWORD="${DB_URL#postgresql://${DB_USER}:}"; DB_PASSWORD="${DB_PASSWORD%%@*}"
DB_HOSTPORT="${DB_URL#*@}"; DB_HOST="${DB_HOSTPORT%%:*}"; DB_PORT="${DB_HOSTPORT#*:}"; DB_PORT="${DB_PORT%%/*}"

if command -v psql >/dev/null 2>&1 && [[ -f "${APP_DIR}/data/db/schema.sql" ]]; then
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" \
        -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 \
        -f "${APP_DIR}/data/db/schema.sql" >/dev/null
    log "Schéma à jour."
else
    warn "psql ou schema.sql indisponible — étape ignorée."
fi

log "Migrations légères (init_db)..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && '${APP_DIR}/.venv/bin/python' -c 'from app.database.init_db import init_db; init_db(); print(\"  → migrations OK\")'"

log "Redémarrage du service ${SERVICE}..."
systemctl restart "${SERVICE}"

for i in $(seq 1 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
        log "Service opérationnel : $(curl -fsS http://127.0.0.1:8000/health)"
        log "Révision déployée : $(sudo -u "${APP_USER}" git -C "${APP_DIR}" rev-parse --short HEAD)"
        exit 0
    fi
    sleep 2
done

warn "Le service ne répond pas — diagnostiquer avec : journalctl -u ${SERVICE} -n 80 --no-pager"
exit 1
