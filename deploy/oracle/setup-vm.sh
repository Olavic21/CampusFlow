#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CampusFlow — provisionnement complet du backend sur une VM Oracle Cloud (OCI)
#
# Cible : Ubuntu 22.04 / 24.04 LTS (VM.Standard.A1.Flex ARM ou VM.Standard.E2.1.Micro x86)
#
# Architecture installée :
#   Internet → Nginx (80/443, Let's Encrypt) → Uvicorn (127.0.0.1:8000, systemd)
#            → FastAPI → SQLite (/var/lib/campusflow/campusflow.db)
#
# Base de données : SQLite (AUCUN PostgreSQL/PostGIS installé).
# Cache           : en mémoire, aucun Redis installé (fallback gracieux du code).
#
# AUCUN secret n'est versionné : le .env est généré sur la VM avec chmod 600.
#
# Usage (en root) :
#   sudo GIT_REF=mobile-release \
#        API_DOMAIN=api-campusflow.duckdns.org \
#        LETSENCRYPT_EMAIL=moi@example.com \
#        CORS_ORIGINS=https://campusflow.vercel.app \
#        bash deploy/oracle/setup-vm.sh
#
#   GIT_REF               branche à déployer (défaut : main).
#                         ⚠️ Elle DOIT contenir le dossier deploy/ ET être POUSSÉE
#                         sur GitHub avant de lancer ce script.
#   API_DOMAIN            domaine public de l'API (obligatoire pour HTTPS certbot)
#   LETSENCRYPT_EMAIL     e-mail Let's Encrypt (obligatoire pour HTTPS)
#   CORS_ORIGINS          origine(s) du frontend Vercel, séparées par des virgules
#   JWT_SECRET            secret JWT (si absent : généré aléatoirement, jamais affiché)
#   REPO_URL              dépôt Git (défaut : dépôt GitHub officiel)
#   SKIP_CERTBOT=1        ne pas demander de certificat (test HTTP uniquement)
#   SEED=0                ne pas injecter les données de démonstration
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
DB_FILE="${DATA_DIR}/campusflow.db"
MEDIA_DIR="${DATA_DIR}/media"
BACKUP_DIR="/var/backups/campusflow"
LOG_DIR="/var/log/campusflow"
JWT_SECRET="${JWT_SECRET:-}"
SKIP_CERTBOT="${SKIP_CERTBOT:-0}"
DATABASE_URL="sqlite:///${DB_FILE}"

log()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn ]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Ce script doit être lancé en root (sudo)."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "$API_DOMAIN" && -z "$LETSENCRYPT_EMAIL" && "$SKIP_CERTBOT" != "1" ]]; then
    die "LETSENCRYPT_EMAIL est requis pour activer HTTPS (ou SKIP_CERTBOT=1)."
fi

# Chemin absolu → 4 slashes dans l'URL SQLAlchemy (3 slashes = chemin relatif !)
[[ "${DATABASE_URL}" == sqlite:////* ]] || die "DATABASE_URL invalide : ${DATABASE_URL} (4 slashes attendus pour un chemin absolu)."

# ── 1. Paquets système (ni PostgreSQL, ni Redis) ─────────────────────────────
log "Installation des paquets système (peut prendre quelques minutes)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg git rsync ufw \
    python3 python3-venv python3-dev python3-pip build-essential \
    nginx certbot python3-certbot-nginx

# ── 2. Utilisateur système et arborescence ───────────────────────────────────
log "Création de l'utilisateur système ${APP_USER} et des dossiers persistants..."
id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "${APP_USER}"
mkdir -p "${APP_DIR}" "${DATA_DIR}/media/avatars" "${BACKUP_DIR}" "${LOG_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}" "${DATA_DIR}" "${BACKUP_DIR}" "${LOG_DIR}"
chmod 750 "${DATA_DIR}" "${BACKUP_DIR}" "${LOG_DIR}"

# ── 3. Code source ───────────────────────────────────────────────────────────
# La branche doit exister côté distant (dépôt privé : utiliser une URL avec jeton
# ou une clé de déploiement, sinon ce contrôle échoue).
if ! sudo -u "${APP_USER}" git ls-remote --exit-code --heads "${REPO_URL}" "${GIT_REF}" >/dev/null 2>&1; then
    die "Branche '${GIT_REF}' introuvable dans ${REPO_URL}. Poussez-la d'abord (git push origin ${GIT_REF}) ou passez GIT_REF=<autre-branche>."
fi

if [[ -d "${APP_DIR}/.git" ]]; then
    log "Dépôt déjà présent : mise à jour (git fetch + reset sur ${GIT_REF})..."
    sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --prune origin
    sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${GIT_REF}"
    sudo -u "${APP_USER}" git -C "${APP_DIR}" reset --hard "origin/${GIT_REF}"
else
    log "Clone du dépôt ${REPO_URL} (branche ${GIT_REF})..."
    sudo -u "${APP_USER}" git clone --branch "${GIT_REF}" "${REPO_URL}" "${APP_DIR}"
fi

# Garde-fou : sans les scripts de déploiement, la suite ne peut pas fonctionner.
[[ -f "${APP_DIR}/deploy/oracle/setup-vm.sh" ]] || die \
    "deploy/oracle/setup-vm.sh absent de la branche '${GIT_REF}': cette branche ne contient pas les fichiers de déploiement (commits non poussés ?)."
log "Code source prêt : $(sudo -u "${APP_USER}" git -C "${APP_DIR}" rev-parse --short HEAD) sur ${GIT_REF}"

# L'utilitaire SQLite est pris dans le dépôt cloné (robuste même si le script est lancé
# depuis une copie temporaire) : sert à contrôler l'intégrité et compter les données.
UTIL="${APP_DIR}/deploy/oracle/sqlite_util.py"
[[ -f "${UTIL}" ]] || die "Outil introuvable : ${UTIL}"

# ── 4. Base de données SQLite persistante ────────────────────────────────────
# La base vit dans ${DATA_DIR} (hors du dossier de code) : un git reset --hard ou
# un redéploiement ne peut donc jamais la supprimer.
log "Préparation de la base SQLite : ${DB_FILE}"
if [[ -f "${DB_FILE}" ]]; then
    log "Base existante conservée → contrôle d'intégrité préalable"
    python3 "${UTIL}" check "${DB_FILE}" || die "Base SQLite corrompue : restaurer une sauvegarde (voir docs/DEPLOIEMENT.md § Restauration)."
else
    log "Aucune base existante : elle sera créée par les migrations au § 7."
fi
chown -R "${APP_USER}:${APP_USER}" "${DATA_DIR}"
chmod 750 "${DATA_DIR}"

# ── 5. Environnement Python isolé ────────────────────────────────────────────
log "Création du venv ${APP_DIR}/.venv et installation des dépendances..."
sudo -u "${APP_USER}" python3 -m venv "${APP_DIR}/.venv"
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install --quiet --upgrade pip wheel
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/pip" install --quiet \
    -r "${APP_DIR}/backend/requirements.txt"

# Contrôle réel : SQLAlchemy doit voir un CHEMIN ABSOLU (4 slashes dans l'URL)
log "Vérification de DATABASE_URL avec SQLAlchemy..."
sudo -u "${APP_USER}" "${APP_DIR}/.venv/bin/python" - "$DATABASE_URL" <<'PY' || die "DATABASE_URL mal formée : le chemin SQLite doit être absolu (sqlite:////...)."
import sys
from sqlalchemy.engine import make_url
url = make_url(sys.argv[1])
assert url.database and url.database.startswith("/"), f"chemin non absolu : {url.database!r}"
print(f"  → SQLite absolu confirmé : {url.database}")
PY

# ── 6. Fichier d'environnement (secrets — chmod 600, jamais versionné) ───────
ENV_FILE="${APP_DIR}/backend/.env"
log "Écriture de ${ENV_FILE} (aucun secret n'est affiché)..."
[[ -z "${JWT_SECRET}" ]] && JWT_SECRET="$(openssl rand -hex 32)"
PUBLIC_API_BASE="https://${API_DOMAIN}"
[[ -z "${API_DOMAIN}" ]] && PUBLIC_API_BASE="http://$(hostname -I | awk '{print $1}')"

umask 077
cat > "${ENV_FILE}" <<EOF
# Généré par deploy/oracle/setup-vm.sh — NE PAS COMMITTER

# Base de données : SQLite persistante (hors dossier de code → survit aux déploiements)
DATABASE_URL=${DATABASE_URL}

# Redis non installé : redis_client utilise son stub gracieux (cache mémoire)
REDIS_URL=

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

# ── 7. Migrations + données initiales ────────────────────────────────────────
# init_db() crée les tables manquantes et applique les migrations légères
# (compatibles SQLite) ; le seed n'injecte les données SUP'PTIC que si la base est vide.
log "Création des tables et migrations (init_db)..."
sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && DATABASE_URL='${DATABASE_URL}' '${APP_DIR}/.venv/bin/python' -c 'from app.database.init_db import init_db; init_db(); print(\"  → tables + migrations OK\")'"

LOC_COUNT="$(python3 "${UTIL}" count "${DB_FILE}" locations 2>/dev/null || echo 0)"
if [[ "${SEED:-1}" == "1" && "${LOC_COUNT:-0}" == "0" ]]; then
    log "Base vide → seed des données SUP'PTIC (app.utils.seed)..."
    sudo -u "${APP_USER}" bash -c "cd '${APP_DIR}/backend' && DATABASE_URL='${DATABASE_URL}' '${APP_DIR}/.venv/bin/python' -m app.utils.seed" \
        || warn "Seed impossible (data/raw/campus.json absent ?) — l'API démarrera avec une base vide."
else
    log "Seed ignoré (base déjà peuplée : ${LOC_COUNT} bâtiments)."
fi

chown -R "${APP_USER}:${APP_USER}" "${DATA_DIR}"

# ── 8. Service systemd (démarrage auto + redémarrage en cas de crash) ────────
log "Installation du service systemd campusflow-api..."
install -m 644 "${APP_DIR}/deploy/oracle/campusflow-api.service" /etc/systemd/system/campusflow-api.service
systemctl daemon-reload
systemctl enable campusflow-api
systemctl restart campusflow-api

for i in $(seq 1 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
        log "API locale opérationnelle : $(curl -fsS http://127.0.0.1:8000/health)"
        break
    fi
    [[ $i -eq 30 ]] && warn "L'API ne répond pas encore — consulter : journalctl -u campusflow-api -n 50"
    sleep 2
done

# ── 9. Reverse proxy Nginx ───────────────────────────────────────────────────
log "Configuration de Nginx (reverse proxy)..."
NGINX_SITE=/etc/nginx/sites-available/campusflow-api
install -m 644 "${APP_DIR}/deploy/oracle/nginx-campusflow-api.conf" "${NGINX_SITE}"
if [[ -n "${API_DOMAIN}" ]]; then
    sed -i "s/API_DOMAIN_PLACEHOLDER/${API_DOMAIN}/g" "${NGINX_SITE}"
else
    sed -i "s/API_DOMAIN_PLACEHOLDER/_/" "${NGINX_SITE}"
    warn "Aucun API_DOMAIN fourni : Nginx répondra sur l'IP publique en HTTP (pas de HTTPS sans domaine)."
fi
ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/campusflow-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 10. Pare-feu : uniquement les ports nécessaires ──────────────────────────
log "Pare-feu UFW : SSH + HTTP + HTTPS (le port 8000 reste privé)..."
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | sed 's/^/    /'
warn "Oracle Cloud : ouvrir aussi 80/443 dans la Security List / NSG (Ingress) de la VM — SSH (22) reste limité."

# ── 11. HTTPS Let's Encrypt (certbot) ────────────────────────────────────────
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

# ── 12. Vérification finale ──────────────────────────────────────────────────
PROBE_URL="http://127.0.0.1/health"
[[ -n "${API_DOMAIN}" && "${SKIP_CERTBOT}" != "1" ]] && PROBE_URL="https://${API_DOMAIN}/health"
log "Test public : ${PROBE_URL}"
curl -fsS --max-time 10 "${PROBE_URL}" && echo || warn "Le test public a échoué (DNS, Security List ou certificat à vérifier)."

python3 "${UTIL}" check "${DB_FILE}" || warn "Contrôle d'intégrité SQLite en échec."
FINAL_COUNT="$(python3 "${UTIL}" count "${DB_FILE}" locations 2>/dev/null || echo '?')"

cat <<SUMMARY

────────────────────────────────────────────────────────────────────────────
CampusFlow — backend déployé sur la VM Oracle Cloud
────────────────────────────────────────────────────────────────────────────
  Code source   : ${APP_DIR}            (utilisateur système : ${APP_USER})
  Venv Python   : ${APP_DIR}/.venv
  Secrets       : ${ENV_FILE}           (chmod 600 — jamais versionné)
  Base SQLite   : ${DB_FILE}            (${FINAL_COUNT} bâtiments)
  Médias        : ${MEDIA_DIR}          (avatars persistants)
  Sauvegardes   : ${BACKUP_DIR}
  Service       : campusflow-api.service  (systemd, Restart=always)
  Logs          : journalctl -u campusflow-api -f
  Reverse proxy : Nginx → 127.0.0.1:8000
  API           : ${PROBE_URL%/health}
  Docs API      : ${PROBE_URL%/health}/docs
  Sauvegarde    : sudo bash ${APP_DIR}/deploy/oracle/backup-db.sh

  Action manuelle restante côté Oracle Cloud :
    1. Security List / NSG : Ingress TCP 80 et 443 depuis 0.0.0.0/0 (SSH 22 restreint à votre IP)
    2. DNS : enregistrement A  ${API_DOMAIN:-<api-domaine>}  →  IP publique de la VM
  Puis côté Vercel : VITE_API_URL=${PROBE_URL%/health}
────────────────────────────────────────────────────────────────────────────
SUMMARY


