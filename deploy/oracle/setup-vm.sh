#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CampusFlow — provisionnement complet du backend sur une VM Oracle Cloud (OCI)
#
# Cible : Ubuntu 22.04 / 24.04 LTS (VM.Standard.A1.Flex ARM ou VM.Standard.E2.1.Micro x86)
# Contenu :
#   Nginx (reverse proxy + HTTPS Let's Encrypt) · Uvicorn (systemd) ·
#   PostgreSQL + PostGIS · Redis · /media persistant · pare-feu UFW · service auto-restart
#
# AUCUN secret n'est versionné : le .env est généré sur la VM avec chmod 600.
#
# Usage (en root) :
#   sudo API_DOMAIN=api-campusflow.duckdns.org \
#        LETSENCRYPT_EMAIL=moi@example.com \
#        CORS_ORIGINS=https://campusflow.vercel.app \
#        DB_PASSWORD='<mot-de-passe-fort>' \
#        bash deploy/oracle/setup-vm.sh
#
#   API_DOMAIN            domaine public de l'API (obligatoire pour HTTPS certbot)
#   LETSENCRYPT_EMAIL     e-mail Let's Encrypt (obligatoire pour HTTPS)
#   CORS_ORIGINS          origine(s) du frontend Vercel, séparées par des virgules
#   DB_PASSWORD           mot de passe PostgreSQL (si absent : généré aléatoirement)
#   JWT_SECRET            secret JWT (si absent : généré aléatoirement, jamais affiché)
#   REPO_URL              dépôt Git (défaut : dépôt GitHub officiel)
#   SKIP_CERTBOT=1        ne pas demander de certificat (test HTTP uniquement)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

API_DOMAIN="${API_DOMAIN:-}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
CORS_ORIGINS="${CORS_ORIGINS:-}"
REPO_URL="${REPO_URL:-https://github.com/nkoumougrinnel/CampusFlow.git}"
GIT_REF="${GIT_REF:-main}"
APP_USER="campusflow"
APP_DIR="/opt/campusflow"
DATA_DIR="/var/lib/campusflow"
MEDIA_DIR="${DATA_DIR}/media"
LOG_DIR="/var/log/campusflow"
DB_NAME="${DB_NAME:-campusflow}"
DB_USER="${DB_USER:-campusflow}"
DB_PASSWORD="${DB_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
SKIP_CERTBOT="${SKIP_CERTBOT:-0}"

log()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn ]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Ce script doit être lancé en root (sudo)."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_SRC="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -n "$API_DOMAIN" && -z "$LETSENCRYPT_EMAIL" && "$SKIP_CERTBOT" != "1" ]]; then
    die "LETSENCRYPT_EMAIL est requis pour activer HTTPS (ou SKIP_CERTBOT=1)."
fi

# ── 1. Paquets système ───────────────────────────────────────────────────────
log "Installation des paquets système (peut prendre quelques minutes)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git rsync ufw \
    python3 python3-venv python3-dev python3-pip build-essential libpq-dev \
    nginx certbot python3-certbot-nginx \
    postgresql postgresql-contrib redis-server

# PostGIS : nom du paquet variable selon la version de PostgreSQL fournie
PG_MAJOR="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -n1 || echo '')"
if [[ -n "$PG_MAJOR" ]]; then
    apt-get install -y --no-install-recommends "postgresql-${PG_MAJOR}-postgis-3" \
        || warn "Paquet postgis introuvable pour PostgreSQL ${PG_MAJOR} — vérifier 'apt search postgis'."
else
    warn "Version de PostgreSQL non détectée : installer PostGIS manuellement."
fi

systemctl enable --now postgresql
systemctl enable --now redis-server

# ── 2. Utilisateur et arborescence ───────────────────────────────────────────
log "Création de l'utilisateur système ${APP_USER} et des dossiers..."
id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "${APP_USER}"
mkdir -p "${APP_DIR}" "${MEDIA_DIR}/avatars" "${LOG_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}" "${LOG_DIR}"
chmod 750 "${DATA_DIR}" "${LOG_DIR}"

# ── 3. Code source ───────────────────────────────────────────────────────────
if [[ -d "${APP_DIR}/.git" ]]; then
    log "Dépôt déjà présent : mise à jour (git fetch + reset sur ${GIT_REF})..."
    sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --prune origin
    sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${GIT_REF}"
    sudo -u "${APP_USER}" git -C "${APP_DIR}" reset --hard "origin/${GIT_REF}"
else
    log "Clone du dépôt ${REPO_URL} (branche ${GIT_REF})..."
    sudo -u "${APP_USER}" git clone --branch "${GIT_REF}" "${REPO_URL}" "${APP_DIR}"
fi

# ── 4. Base de données PostgreSQL + PostGIS ──────────────────────────────────
log "Configuration de PostgreSQL (base ${DB_NAME}, rôle ${DB_USER})..."
if [[ -z "${DB_PASSWORD}" ]]; then
    DB_PASSWORD="$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | cut -c1-24)"
fi
if [[ "${DB_PASSWORD}" =~ [@:/?\#\[\]] ]]; then
    warn "DB_PASSWORD contient des caractères réservés d'URL : ils seront encodés dans DATABASE_URL."
fi

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"

sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

# PostGIS (extension = privilège superutilisateur) puis privilèges applicatifs
sudo -u postgres psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT CREATE, USAGE ON SCHEMA public TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# Schéma CampusFlow, appliqué AVEC le rôle applicatif → tables possédées par ${DB_USER}
if [[ -f "${APP_DIR}/data/db/schema.sql" ]]; then
    log "Application de data/db/schema.sql (idempotent)..."
    PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" \
        -v ON_ERROR_STOP=1 -f "${APP_DIR}/data/db/schema.sql"
else
    warn "data/db/schema.sql introuvable — les tables seront créées par l'ORM au démarrage."
fi

# ── 5. Environnement Python isolé ────────────────────────────────────────────
log "Création du venv ${APP_DIR}/.venv et installation des dépendances..."
sudo -u "${APP_USER}" python3 -m venv "${APP_DIR}/.venv"
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install --quiet --upgrade pip wheel
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install --quiet \
    -r "${APP_DIR}/backend/requirements.txt"

# ── 6. Fichier d'environnement (secrets — chmod 600, jamais versionné) ───────
ENV_FILE="${APP_DIR}/backend/.env"
log "Écriture de ${ENV_FILE} (aucun secret n'est affiché)..."
[[ -z "${JWT_SECRET}" ]] && JWT_SECRET="$(openssl rand -hex 32)"
PUBLIC_API_BASE="https://${API_DOMAIN}"
[[ -z "${API_DOMAIN}" ]] && PUBLIC_API_BASE="http://$(hostname -I | awk '{print $1}')"

umask 077
cat > "${ENV_FILE}" <<EOF
# Généré par deploy/oracle/setup-vm.sh — NE PAS COMMITTER
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD//@/%40}@127.0.0.1:5432/${DB_NAME}
REDIS_URL=redis://127.0.0.1:6379/0

CORS_ORIGINS=${CORS_ORIGINS}
CORS_ORIGIN_REGEX=

JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=30
BCRYPT_ROUNDS=10

MEDIA_ROOT=${MEDIA_DIR}
MEDIA_URL=/media
AVATAR_MAX_UPLOAD_BYTES=5242880
PUBLIC_API_BASE=${PUBLIC_API_BASE}

ML_MODEL_PATH=${APP_DIR}/ml/model.pkl

SENSOR_MODE=simulation
SENSOR_SIM_INTERVAL_SEC=10
CAPTEURS_JSON_PATH=${APP_DIR}/data/raw/capteurs.json

STALE_AFTER_SEC=120
SENSOR_HEARTBEAT_OFFLINE_SEC=90
RETENTION_DAYS=90
EOF
chmod 600 "${ENV_FILE}"
chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"

# Migrations légères idempotentes (colonne users.role, index unique favoris)
log "Application des migrations légères (init_db)..."
sudo -u "${APP_USER}" env "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}" \
    bash -c "cd '${APP_DIR}/backend' && '${APP_DIR}/.venv/bin/python' -c 'from app.database.init_db import init_db; init_db(); print(\"migrations OK\")'"

# Seed initial uniquement si la base est vide (38 bâtiments SUP'PTIC + flux récents)
LOC_COUNT="$(sudo -u postgres psql -tAc "SELECT count(*) FROM locations;" -d "${DB_NAME}" || echo 0)"
if [[ "${SEED:-1}" == "1" && "${LOC_COUNT:-0}" == "0" ]]; then
    log "Base vide → seed des données SUP'PTIC (app.utils.seed)..."
    sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && '${APP_DIR}/.venv/bin/python' -m app.utils.seed" \
        || warn "Seed impossible (data/raw/campus.json absent ?) — l'API démarrera avec une base vide."
else
    log "Seed ignoré (base non vide ou SEED=0)."
fi

# ── 7. Service systemd (démarrage auto + redémarrage en cas de crash) ───────
log "Installation du service systemd campusflow-api..."
install -m 644 "${APP_DIR}/deploy/oracle/campusflow-api.service" /etc/systemd/system/campusflow-api.service
systemctl daemon-reload
systemctl enable campusflow-api
systemctl restart campusflow-api

# Attente du démarrage (health check local)
for i in $(seq 1 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
        log "API locale opérationnelle : $(curl -fsS http://127.0.0.1:8000/health)"
        break
    fi
    [[ $i -eq 30 ]] && warn "L'API ne répond pas encore — consulter : journalctl -u campusflow-api -n 50"
    sleep 2
done

# ── 8. Reverse proxy Nginx ───────────────────────────────────────────────────
log "Configuration de Nginx (reverse proxy)..."
NGINX_SITE=/etc/nginx/sites-available/campusflow-api
install -m 644 "${APP_DIR}/deploy/oracle/nginx-campusflow-api.conf" "${NGINX_SITE}"
if [[ -n "${API_DOMAIN}" ]]; then
    sed -i "s/API_DOMAIN_PLACEHOLDER/${API_DOMAIN}/g" "${NGINX_SITE}"
else
    # Sans domaine : accepter l'IP publique sur l'écoute 80
    sed -i "s/API_DOMAIN_PLACEHOLDER/_/" "${NGINX_SITE}"
    warn "Aucun API_DOMAIN fourni : Nginx répondra sur l'IP publique en HTTP (pas de HTTPS possible sans domaine)."
fi
ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/campusflow-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 9. Pare-feu : uniquement les ports nécessaires ──────────────────────────
log "Pare-feu UFW : SSH + HTTP + HTTPS (le port 8000 reste privé)..."
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | sed 's/^/    /'
warn "Oracle Cloud : ouvrir aussi 80/443 dans la Security List / NSG (Ingress) de la VM — SSH (22) reste limité."

# ── 10. HTTPS Let's Encrypt (certbot) ────────────────────────────────────────
if [[ -n "${API_DOMAIN}" && "${SKIP_CERTBOT}" != "1" ]]; then
    log "Demande du certificat Let's Encrypt pour ${API_DOMAIN}..."
    certbot --nginx \
        -d "${API_DOMAIN}" \
        -m "${LETSENCRYPT_EMAIL}" \
        --non-interactive --agree-tos --redirect --hsts --staple-ocsp \
        || warn "certbot a échoué : vérifier que le DNS ${API_DOMAIN} pointe bien vers l'IP de la VM (A record)."
    systemctl enable --now certbot.timer >/dev/null 2>&1 || true
else
    warn "HTTPS ignoré (API_DOMAIN vide ou SKIP_CERTBOT=1)."
fi

# ── 11. Vérification finale ──────────────────────────────────────────────────
PROBE_URL="http://127.0.0.1/health"
[[ -n "${API_DOMAIN}" && "${SKIP_CERTBOT}" != "1" ]] && PROBE_URL="https://${API_DOMAIN}/health"
log "Test public : ${PROBE_URL}"
curl -fsS --max-time 10 "${PROBE_URL}" && echo || warn "Le test public a échoué (DNS, Security List ou certificat à vérifier)."

cat <<SUMMARY

────────────────────────────────────────────────────────────────────────────
CampusFlow — backend déployé sur la VM Oracle Cloud
────────────────────────────────────────────────────────────────────────────
  Code source   : ${APP_DIR}            (utilisateur système : ${APP_USER})
  Venv Python   : ${APP_DIR}/.venv
  Secrets       : ${ENV_FILE}           (chmod 600 — jamais versionné)
  Médias        : ${MEDIA_DIR}
  Service       : campusflow-api.service  (systemd, Restart=always)
  Logs          : journalctl -u campusflow-api -f
  Reverse proxy : Nginx → 127.0.0.1:8000
  API           : ${PROBE_URL%/health}
  Docs API      : ${PROBE_URL%/health}/docs
  Base          : PostgreSQL + PostGIS, base "${DB_NAME}", rôle "${DB_USER}"
  Sauvegarde    : sudo bash ${APP_DIR}/deploy/oracle/backup-db.sh

  Action manuelle restante côté Oracle Cloud :
    1. Security List / NSG : Ingress TCP 80 et 443 depuis 0.0.0.0/0 (SSH 22 restreint à votre IP)
    2. DNS : enregistrement A  ${API_DOMAIN:-<api-domaine>}  →  IP publique de la VM
  Puis côté Vercel : VITE_API_URL=${PROBE_URL%/health}
────────────────────────────────────────────────────────────────────────────
SUMMARY


