# CampusFlow — Guide de déploiement en production

> ## ⚠️ ARCHITECTURE ACTUELLE : VERCEL + RENDER (SQLite)
>
> Le déploiement de référence est désormais :
>
> ```
> GitHub
>  ├──► Vercel  — React 19 + Vite 8 (frontend/, Root Directory = frontend)
>  └──► Render  — FastAPI + Uvicorn + SQLite (backend/, Root Directory = backend)
> ```
>
> → **Guide Render** : [`deploy/render/README.md`](../deploy/render/README.md)
> → **Blueprint Render** : [`deploy/render/render.yaml`](../deploy/render/render.yaml)
> → **Gabarit env Render** : [`deploy/render/.env.render.example`](../deploy/render/.env.render.example)
>
> **Limitation Render Free** : le système de fichiers local est éphémère.
> **SQLite sur Render Free = stockage non durable** — la base (recréée par
> `init_db()` + seed à chaque démarrage : 38 bâtiments SUP'PTIC, capteurs simulés)
> et les avatars uploadés sont perdus lors d'un redéploiement/replacement.
> Un Disk Render (Starter+) monté sur `/data` avec
> `DATABASE_URL=sqlite:////data/campusflow.db` est requis pour la persistance.
> Cette architecture est une **version de démonstration/test**, pas une
> infrastructure de production durable.
>
> ---
>
> ## 🗄️ OBSOLÈTE — La suite de ce document décrit le déploiement Oracle Cloud
>
> Les sections suivantes (Oracle Cloud, systemd, Nginx, `/var/lib/campusflow`,
> PostgreSQL+PostGIS) sont **historiques** : `deploy/oracle/` n'est plus le chemin
> de déploiement principal. Ne pas l'utiliser pour un nouveau déploiement.
>
> ---

> Backend : Render (FastAPI + SQLite) · Frontend : Vercel · ~~Historique : Oracle Cloud (OCI) + PostgreSQL + PostGIS~~
> Dernière révision : 22/09/2026 — branche de référence : `mobile-release`

## 0. Statut du déploiement — à lire avant tout

| Élément | Statut |
|---|---|
| Correctifs de production (backend + frontend) | ✅ **appliqués dans le dépôt** |
| Scripts de déploiement Oracle Cloud (`deploy/oracle/`) | ✅ **fournis, prêts à exécuter** |
| Configuration Vercel (`frontend/vercel.json`, variables) | ✅ **fournie, prête à appliquer** |
| Vérification E2E **en local**, en configuration identique à la production | ✅ **20/20 contrôles réussis** (API, CORS, bundle, données) |
| Tests automatisés | ✅ backend **55 passed**, frontend **17 passed**, ESLint **0 erreur** |
| Exécution réelle sur une VM Oracle Cloud | ⏳ **à lancer** — aucun accès OCI disponible sur la machine de préparation |
| Déploiement réel sur Vercel | ⏳ **à lancer** — aucun jeton Vercel disponible sur la machine de préparation |
| PostgreSQL/PostGIS exécuté localement | ⏳ **non testé localement** : moteur Docker Desktop indisponible ; la vérification locale a utilisé SQLite (base supportée par le projet), le chemin PostgreSQL est automatisé par `setup-vm.sh` |

**Aucun secret n'est versionné** : tous les fichiers `.env*` suivis par Git sont des gabarits à placeholders `<...>`.

Les sections 3 à 7 sont la procédure exacte à exécuter. Les sections 8 et 9 listent ce qui a déjà été **réellement vérifié** et ce qui reste à vérifier **après** la mise en ligne.

---

## 1. Architecture de production

```
  Navigateur / APK
        │  HTTPS (application React 19 + Vite 8)
        ▼
  VERCEL — frontend statique (dossier frontend/, build Vite → dist/)
        │
        │  HTTPS + WSS  (VITE_API_URL / VITE_WS_URL ; origine autorisée par CORS)
        ▼
  ORACLE CLOUD — VM Ubuntu LTS (VCN, IP publique)
   ├── Nginx :80/:443  (reverse proxy, TLS Let's Encrypt, en-têtes de sécurité)
   │        │ proxy_pass → 127.0.0.1:8000
   │        ▼
   ├── campusflow-api.service (systemd) → Uvicorn, FastAPI (app.main:app, 1 worker)
   │        │ SQLAlchemy / psycopg2
   │        ▼
   ├── PostgreSQL + PostGIS (127.0.0.1:5432 — jamais exposé sur Internet)
   └── Redis (127.0.0.1:6379 — cache, facultatif : fallback gracieux du code)

  Fichiers statiques (avatars WebP) : /var/lib/campusflow/media, servis par l'API sous /media
```

Flux d'une requête : `Navigateur → Vercel (assets statiques) → fetch VITE_API_URL → Nginx (TLS) → Uvicorn → PostgreSQL`.

Contraintes imposées par le projet existant :

- **WebSocket** `/ws/live-occupancy/` : Nginx doit conserver les en-têtes `Upgrade` (déjà fait dans le vhost fourni) ;
- **Uvicorn `--workers 1`** : le simulateur de capteurs et le hub WebSocket tiennent un état en mémoire — plusieurs workers le dupliqueraient ;
- **Migrations** : `data/db/schema.sql` (PostgreSQL + PostGIS) puis migrations légères idempotentes `app/database/init_db.py` (colonne `users.role`, index unique `favorite_routes`) ;
- **Données** : `app/utils/seed.py` (38 bâtiments SUP'PTIC + flux récents remappés depuis `data/raw/capteurs.json`) ;
- **Médias** : `MEDIA_ROOT` doit pointer vers un dossier persistant (`/var/lib/campusflow/media`).

---

## 2. Prérequis

| Ressource | Détail |
|---|---|
| VM Oracle Cloud | Ubuntu 22.04 ou 24.04 LTS. ARM `VM.Standard.A1.Flex` (2 OCPU / 12 Go, éligible Always Free) ou x86 `VM.Standard.E2.1.Micro`. **1 Go de RAM suffit** (venv ≈ 600 Mo) |
| Réseau OCI | VCN + subnet public + Internet Gateway + **Security List/NSG : Ingress TCP 22, 80, 443** (le port 8000 reste fermé) |
| Domaine | Pour HTTPS : `api-campusflow.duckdns.org` (gratuit) ou un sous-domaine de votre domaine → **enregistrement A vers l'IP publique de la VM** |
| Compte Vercel | Accès au dépôt GitHub `nkoumougrinnel/CampusFlow` |
| Accès SSH | Clé SSH associée à l'instance OCI |
| Branche Git à déployer | La branche contenant le dossier **`deploy/`** doit être **poussée sur GitHub avant** de cloner la VM (aujourd'hui : `mobile-release`). Sinon `setup-vm.sh` s'arrête avec un message explicite |

**Pourquoi HTTPS est obligatoire côté API :** le frontend est servi en HTTPS par Vercel ; un navigateur **bloque** tout `fetch` HTTPS → HTTP (contenu mixte). Sans certificat sur l'API, la seule alternative serait de proxifier `/api/*` depuis Vercel (voir § 6).

---

## 3. Procédure — Backend Oracle Cloud

### 3.1 Ouvrir les ports dans OCI (avant le SSH)

Console OCI → *Networking → Virtual Cloud Networks → Subnet → Security Lists* (ou NSG de l'instance) :

| Direction | Source | Protocole | Port |
|---|---|---|---|
| Ingress | `0.0.0.0/0` | TCP | 80 |
| Ingress | `0.0.0.0/0` | TCP | 443 |
| Ingress | **votre IP seule** (ex. `41.x.x.x/32`) | TCP | 22 |

Ne jamais ouvrir 5432 (PostgreSQL), 6379 (Redis) ni 8000 (Uvicorn) : ils restent en écoute locale uniquement.

### 3.2 Se connecter et récupérer le code

```bash
# 1) Sur votre machine : pousser la branche qui contient deploy/ (sinon la VM ne l'aura pas)
git push origin mobile-release          # adaptez le nom de la branche

# 2) Sur la VM
ssh -i ~/.ssh/<CLE_OCI>.key ubuntu@<IP_PUBLIQUE_VM>

sudo apt-get update && sudo apt-get install -y git
sudo git clone --branch mobile-release \
    https://github.com/nkoumougrinnel/CampusFlow.git /opt/campusflow
cd /opt/campusflow
```

Le script vérifie automatiquement que la branche existe côté GitHub **et** qu'elle contient `deploy/oracle/setup-vm.sh` ; sinon il s'arrête avec la marche à suivre (`GIT_REF=<branche>`).

### 3.3 Provisionnement complet (script fourni)

Le script installe et configure **tout** : paquets système, venv Python, `.env`, base SQLite, migrations, seed, service systemd, Nginx, UFW, HTTPS Let's Encrypt, puis teste l'API. AUCUN PostgreSQL/PostGIS ni Redis n'est installé.

```bash
sudo GIT_REF=mobile-release \
     API_DOMAIN=api-campusflow.duckdns.org \
     LETSENCRYPT_EMAIL=vous@example.com \
     CORS_ORIGINS=https://<PROJET>.vercel.app \
     bash deploy/oracle/setup-vm.sh
```

- `JWT_SECRET` : **généré aléatoirement** s'il n'est pas fourni, écrit dans `/opt/campusflow/backend/.env` (chmod 600) et **jamais affiché**.
- `DATABASE_URL` pointe vers la base SQLite persistante (`sqlite:////var/lib/campusflow/campusflow.db`, 4 slashes = chemin absolu vérifié par le script via SQLAlchemy).
- Le script est **idempotent** : le relancer met à jour le code et réapplique les migrations (la base SQLite et les médias, hors dossier de code, sont conservés).
- Options : `GIT_REF=<branche>` (défaut `main`), `SKIP_CERTBOT=1` (sans domaine), `SEED=0` (ne pas injecter les données de démo), `REPO_URL=...` (fork).

### 3.4 Ce qui est configuré

| Élément | Valeur |
|---|---|
| Code | `/opt/campusflow` (utilisateur système `campusflow`) |
| Venv | `/opt/campusflow/.venv` |
| Secrets | `/opt/campusflow/backend/.env` — `chmod 600`, propriétaire `campusflow` |
| Base SQLite | `/var/lib/campusflow/campusflow.db` — persistante, hors dossier de code |
| Médias | `/var/lib/campusflow/media` (+ `avatars/`) — persistants |
| Sauvegardes SQLite | `/var/backups/campusflow/campusflow-<date>.db` (copies cohérentes + rotation) |
| Service | `/etc/systemd/system/campusflow-api.service` → `Restart=always`, `RestartSec=5`, hardening (`NoNewPrivileges`, `ProtectSystem=full`, `ProtectHome=true`) |
| Commande de démarrage | `.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --proxy-headers` |
| Nginx | `/etc/nginx/sites-available/campusflow-api` → `127.0.0.1:8000` (+ locations `/ws/`, `/media/`, `/api/`) |
| Logs | journald : `journalctl -u campusflow-api` ; Nginx : `/var/log/nginx/campusflow-api.*.log` |
| Pare-feu | UFW : 22, 80, 443 uniquement |

### 3.5 Variables d'environnement du backend

Gabarit versionné : `backend/.env.production.example` (aucune valeur réelle). Renseignées par `setup-vm.sh` dans `/opt/campusflow/backend/.env` :

```
DATABASE_URL=sqlite:////var/lib/campusflow/campusflow.db
REDIS_URL=
CORS_ORIGINS=https://<PROJET>.vercel.app
CORS_ORIGIN_REGEX=<vide>
JWT_SECRET=<JWT_SECRET>
JWT_ACCESS_MINUTES=60
JWT_REFRESH_DAYS=30
BCRYPT_ROUNDS=10
MEDIA_ROOT=/var/lib/campusflow/media
MEDIA_URL=/media
PUBLIC_API_BASE=https://<API_DOMAIN>
ML_MODEL_PATH=/opt/campusflow/ml/model.pkl
SENSOR_MODE=simulation
SENSOR_SIM_INTERVAL_SEC=10
CAPTEURS_JSON_PATH=/opt/campusflow/data/raw/capteurs.json
STALE_AFTER_SEC=120
SENSOR_HEARTBEAT_OFFLINE_SEC=90
RETENTION_DAYS=90
```

4 slashes = chemin SQLite ABSOLU (exigé par SQLAlchemy, vérifié par `setup-vm.sh`).
`REDIS_URL` est laissé vide : Redis n'est pas installé, `redis_client` utilise son stub gracieux (cache en mémoire). `ML_MODEL_PATH` est optionnel (`/predict` renvoie alors 503).

## 4. Procédure — Frontend Vercel

### 4.1 Créer le projet

1. Vercel → *Add New… → Project* → **Import Git Repository** → `nkoumougrinnel/CampusFlow`.
2. **Root Directory : `frontend`** (⚠️ indispensable : `frontend/vercel.json` et `dist/` s'y trouvent).
3. Framework détecté : **Vite** (imposé par `frontend/vercel.json`) — install `npm ci`, build `npm run build`, output `dist`.
4. `frontend/package-lock.json` est versionné : `npm ci` est donc utilisable pour des builds reproductibles (validé par `npm ci --dry-run`, code de sortie 0). La règle d'exclusion qui figurait dans `frontend/.gitignore` a été retirée pour éviter toute ambiguïté.

### 4.2 Variables d'environnement (Production)

| Variable | Valeur | Rôle |
|---|---|---|
| `VITE_API_URL` | `https://<API_DOMAIN>` | base des appels REST (`api.js`, `authApi.js`, `sensorApi.js`, `profileApi.js`, `adminApi.js`) |
| `VITE_WS_URL` | `wss://<API_DOMAIN>` | WebSocket `/ws/live-occupancy/` |
| `VITE_BACKEND_DIRECT` | `https://<API_DOMAIN>` | base des médias (avatars) |
| `VITE_SENSOR_MODE` | `api` | source des données capteurs |

⚠️ **Ne pas mettre `VITE_API_URL=/api` sur Vercel** : `/api` n'existe que via le proxy Vite de développement (`vite.config.js`, non utilisé en production).

### 4.3 Redéployer

- **Automatique** : chaque `git push` sur la branche connectée déclenche un build.
- **Manuel** : `npx vercel --prod` (ou bouton *Redeploy* dans le tableau de bord).
- Après un changement de variable d'environnement, un **redéploiement est nécessaire** (les valeurs `VITE_*` sont compilées dans le bundle).

---

## 5. Base de données — SQLite persistant

| Élément | Détail |
|---|---|
| Technologie | **SQLite** (décision v1 production — aucun PostgreSQL/PostGIS installé, aucune migration prévue) |
| Emplacement | **`/var/lib/campusflow/campusflow.db`** — hors du dossier de code `/opt/campusflow`, donc jamais écrasé par un déploiement |
| Connexion applicative | `DATABASE_URL=sqlite:////var/lib/campusflow/campusflow.db` (**4 slashes** = chemin absolu ; 3 slashes seulement produiraient un chemin relatif au CWD, vérifié automatiquement par `setup-vm.sh` via `sqlalchemy.engine.make_url`) |
| Création des tables | `Base.metadata.create_all(bind=engine)` dans `app/database/init_db.py` (compatible SQLite) |
| Migrations | `app/database/init_db.py` à chaque démarrage : ajout idempotent de la colonne `users.role`, index unique `favorite_routes` — requêtes `ALTER TABLE ... ADD COLUMN` et `CREATE UNIQUE INDEX IF NOT EXISTS` compatibles SQLite |
| Journalisation | Mode WAL activé par `app/database/session.py` (`PRAGMA journal_mode=WAL`, `busy_timeout=15000`) — lectures/écritures concurrentes gérées |
| Données initiales | `app/utils/seed.py` depuis `data/raw/campus.json` + `data/raw/capteurs.json` (38 bâtiments SUP'PTIC + flux récents) — exécuté par `setup-vm.sh` **uniquement si la base est vide** (comptage via `sqlite_util.py count`) |
| Permissions | `/var/lib/campusflow` : propriétaire `campusflow:campusflow`, `chmod 750` ; systemd `ReadWritePaths=/var/lib/campusflow` |

> Note : `data/db/schema.sql` reste présent dans le dépôt comme référence historique (PostgreSQL + PostGIS) mais **n'est utilisé par aucun script de production**.

### Sauvegarde SQLite

La sauvegarde utilise `deploy/oracle/sqlite_util.py backup`, qui appelle l'**API de sauvegarde de SQLite** (`Connection.backup`) produisant un **instantané transactionnel cohérent** — même si l'API écrit pendant l'opération (mode WAL inclus). **Ce n'est jamais un simple `cp`**, qui pourrait copier un fichier en pleine écriture.

```bash
sudo bash /opt/campusflow/deploy/oracle/backup-db.sh        # sauvegarde immédiate

sudo crontab -e      # sauvegarde quotidienne à 03:00
0 3 * * * /bin/bash /opt/campusflow/deploy/oracle/backup-db.sh >> /var/log/campusflow/backup.log 2>&1
```

Le script contrôle ensuite la copie (`integrity_check` + `quick_check`), affiche le nombre de bâtiments sauvegardés, puis purge automatiquement les sauvegardes de plus de `RETENTION_DAYS=14` jours (`sqlite_util.py prune`).

Sauvegardes : `/var/backups/campusflow/campusflow-<AAAAmmjj-HHMMSS>.db`.

### Restauration SQLite

```bash
# 1) Arrêter le service pour figer la base
sudo systemctl stop campusflow-api

# 2) Restaurer (vérifie que la sauvegarde est bien du SQLite et remplace
#    intégralement le contenu de la base cible)
sudo /opt/campusflow/.venv/bin/python /opt/campusflow/deploy/oracle/sqlite_util.py \
    restore /var/backups/campusflow/campusflow-<date>.db /var/lib/campusflow/campusflow.db

# 3) Vérifier la base restaurée
sudo /opt/campusflow/.venv/bin/python /opt/campusflow/deploy/oracle/sqlite_util.py \
    check /var/lib/campusflow/campusflow.db

# 4) Redémarrer le service
sudo systemctl start campusflow-api
curl -fsS http://127.0.0.1:8000/health
```

---

## 6. Configuration CORS

Source : `backend/app/config.py` (`CORS_ORIGINS`, `CORS_ORIGIN_REGEX`) appliquée par `CORSMiddleware` dans `backend/app/main.py` (`allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`).

| Contexte | Origines autorisées |
|---|---|
| Production | **uniquement** `CORS_ORIGINS` → le domaine Vercel de production, ex. `https://campusflow.vercel.app` |
| Previews Vercel (optionnel) | `CORS_ORIGIN_REGEX=https://.*\.vercel\.app` — ⚠️ autorise **toutes** les applications `*.vercel.app` : à activer en connaissance de cause |
| Développement | valeur par défaut du code : `http://localhost:5173`, `http://localhost:3000`, `http://127.0.0.1:5173`, `https://localhost`, `capacitor://localhost` |
| APK Capacitor | `https://localhost`, `capacitor://localhost` (à ajouter à `CORS_ORIGINS` si l'APK doit joindre l'API en ligne) |

Pourquoi une liste explicite : `allow_credentials=True` est nécessaire au JWT côté navigateur, et la spécification CORS **interdit** la combinaison `Access-Control-Allow-Origin: *` + credentials. Les origines doivent donc être nommées une par une.

> Alternative sans CORS : réécrire `/api/*` vers le backend via `frontend/vercel.json` (`rewrites`). Non retenue : elle masque la topologie réelle et rend le diagnostic plus difficile.

---

## 7. URLs finales

| Élément | URL |
|---|---|
| Frontend (Vercel) | `https://<PROJET>.vercel.app` |
| Backend / API (Oracle Cloud) | `https://<API_DOMAIN>` (ex. `https://api-campusflow.duckdns.org`) |
| Documentation interactive de l'API (Swagger) | `https://<API_DOMAIN>/docs` |
| Spécification OpenAPI | `https://<API_DOMAIN>/openapi.json` |
| Health check | `https://<API_DOMAIN>/health` |
| WebSocket temps réel | `wss://<API_DOMAIN>/ws/live-occupancy/` |
| Médias (avatars) | `https://<API_DOMAIN>/media/avatars/...` |

Vérification automatique de l'ensemble :

```bash
python scripts/verify_deployment.py \
    --api https://<API_DOMAIN> \
    --frontend https://<PROJET>.vercel.app \
    --origin https://<PROJET>.vercel.app
```

---

## 8. Tests effectués et résultats

### 8.1 Vérifications RÉELLEMENT exécutées (machine locale, configuration identique à la production)

Commande : `python scripts/verify_deployment.py --api http://127.0.0.1:8100 --frontend http://127.0.0.1:4173 --origin https://campusflow.vercel.app`
Contexte : base fraîche (SQLite `.deploy_check.db`, 38 bâtiments + 3648 flux injectés par `app.utils.seed`), backend Uvicorn avec `CORS_ORIGINS=http://127.0.0.1:4173,https://campusflow.vercel.app`, `SENSOR_MODE=simulation`, frontend `dist/` servi en statique.

| # | Test | Résultat |
|---|---|---|
| 1 | `GET /health` | ✅ HTTP 200 |
| 2 | `GET /` (racine API) | ✅ HTTP 200 |
| 3 | `GET /openapi.json` | ✅ 34 routes exposées |
| 4 | `GET /locations` (lecture base de données) | ✅ 38 bâtiments SUP'PTIC |
| 5 | Cohérence des coordonnées SUP'PTIC | ✅ lat/lon dans la zone campus |
| 6 | `GET /flux/live?window=60` (flux temps réel) | ✅ 38 mesures |
| 7 | `GET /flux/history/1?granularity=day` (historique) | ✅ HTTP 200 + `data` |
| 8 | `GET /congestion` | ✅ HTTP 200 |
| 9 | `GET /path?from=1&to=8` (itinéraire) | ✅ HTTP 200 |
| 10 | `GET /dashboard/stats?period=week` | ✅ HTTP 200 |
| 11 | `GET /sensors/status` (IoT) | ✅ HTTP 200 |
| 12 | `GET /incidents?active_only=true` | ✅ HTTP 200 |
| 13 | Préflight CORS `OPTIONS /health` (Origin = domaine Vercel) | ✅ HTTP 200 + `access-control-allow-origin` exact |
| 14 | `GET /health` avec en-tête `Origin` | ✅ `access-control-allow-origin` renvoyé |
| 15 | `access-control-allow-credentials` | ✅ `true` |
| 16 | Frontend accessible (servi en statique) | ✅ HTTP 200, titre CampusFlow |
| 17 | `GET /manifest.webmanifest` (PWA) | ✅ HTTP 200 |
| 18 | Bundles JS/CSS servis | ✅ 9 fichiers |
| 19 | **Aucune URL `localhost`/`127.0.0.1:8000` dans le bundle** | ✅ aucune occurrence |
| 20 | URL d'API compilée dans le bundle (`VITE_API_URL`) | ✅ présente |

**20/20 contrôles réussis.**

Complément — build avec un domaine de production factice (`VITE_API_URL=https://api-campusflow.deploycheck.test`) : ✅ aucune occurrence de `127.0.0.1:8000`, `localhost:8000` ni `127.0.0.1:5173` dans `dist/assets/*.js`, et ✅ présence de `wss://api-campusflow.deploycheck.test` (WebSocket dérivée de `VITE_WS_URL`).

Tests automatisés du dépôt (relancés après modification) :

| Suite | Commande | Résultat |
|---|---|---|
| Backend | `cd backend && pytest tests -q` | ✅ **55 passed** |
| Frontend | `cd frontend && npm test` | ✅ **17 passed** |
| Lint des fichiers modifiés | `npx eslint src/services/sensorApi.js src/utils/avatar.js src/services/authApi.js` | ✅ 0 erreur |
| Build de production | `cd frontend && npm run build` | ✅ `dist/` généré |
| Syntaxe des scripts de déploiement | `bash -n` sur `setup-vm.sh`, `deploy-backend.sh`, `backup-db.sh` | ✅ 3/3 valides |
| Parse de `DATABASE_URL` SQLite | `sqlalchemy.engine.make_url('sqlite:////var/lib/campusflow/campusflow.db')` | ✅ `database == /var/lib/campusflow/campusflow.db` (chemin absolu, 4 slashes) |
| Utilitaires SQLite | `sqlite_util.py check/count/backup/restore/prune` sur une base de test réelle (38 bâtiments + 1 compte utilisateur) | ✅ tous OK, restauration vérifiée (38 bâtiments, 1 compte) |
| API chemins absolus (hors repo) | Base dans `C:\cf-sqlite-prodcheck\` + `MEDIA_ROOT` externe, `init_db` + `seed` suivis de tests HTTP | ✅ 38 bâtiments, 3648 flux |
| Auth JWT sur SQLite | `POST /auth/register` → 201, `POST /auth/login` → 200 + `access_token` | ✅ 5/5 avec médias + WebSocket |
| Avatar (upload/download) | `POST /profile/avatar` (PNG→WebP 64x64), `GET /media/avatars/…` → format image validé | ✅ HTTP 200 |
| WebSocket | Handshake `101` + trame `occupancy_snapshot` (38 mesures, `SENSOR_MODE=simulation`) | ✅ |
| Restart / persistance SQLite | Arrêt du processus puis redémarrage sur la **même base** : login du compte pré-restart → 200, avatar pré-restart → 200 | ✅ données conservées |
| Redéploiement sûr | `DATABASE_URL` hors dossier de code + contrôle d'intégrité avant chaque `deploy-backend.sh` | ✅ documenté et scripté |

### 8.2 Vérifications à exécuter APRÈS la mise en ligne (non exécutables sans accès cloud)

```bash
python scripts/verify_deployment.py --api https://<API_DOMAIN> \
    --frontend https://<PROJET>.vercel.app --origin https://<PROJET>.vercel.app
```

- [ ] API publique joignable en HTTPS (certificat valide)
- [ ] Endpoints principaux : `locations`, `flux/live`, `flux/history`, `congestion`, `path`, `dashboard`, `sensors`, `incidents`
- [ ] DONNÉES réellement issues de SQLite (`/var/lib/campusflow/campusflow.db` : migration + seed effectués)
- [ ] CORS : préflight + GET avec l'origine Vercel
- [ ] Frontend Vercel : chargement, carte, liste des bâtiments, flux temps réel, WebSocket, avatars
- [ ] Auth JWT : inscription / connexion / restauration de session
- [ ] Aucune erreur rouge dans la console du navigateur
- [ ] Redémarrage du service (`sudo systemctl restart campusflow-api`) → API de nouveau opérationnelle
- [ ] `journalctl -u campusflow-api` sans trace d'erreur au démarrage

---

## 9. Maintenance

| Objectif | Procédure |
|---|---|
| **Mettre à jour le backend** | `sudo bash /opt/campusflow/deploy/oracle/deploy-backend.sh` (git pull + dépendances + migrations + restart + health check). Variante `SKIP_GIT=1` pour un code copié manuellement |
| **Redémarrer le backend** | `sudo systemctl restart campusflow-api` |
| **État du service** | `systemctl status campusflow-api` |
| **Consulter les logs** | `journalctl -u campusflow-api -f` (temps réel), `journalctl -u campusflow-api -n 100 --no-pager` |
| **Logs Nginx** | `tail -f /var/log/nginx/campusflow-api.access.log` / `.error.log` |
| **Modifier une variable d'environnement** | `sudo nano /opt/campusflow/backend/.env` puis `sudo systemctl restart campusflow-api` |
| **Appliquer les migrations** | automatique au démarrage (`init_db()`), ou à la demande : `sudo -u campusflow bash -c "cd /opt/campusflow/backend && /opt/campusflow/.venv/bin/python -c 'from app.database.init_db import init_db; init_db()'"` |
| **Re-seed (⚠️ efface flux / feedbacks / locations)** | `sudo -u campusflow bash -c "cd /opt/campusflow/backend && /opt/campusflow/.venv/bin/python -m app.utils.seed"` |
| **Sauvegarder la base** | `sudo bash /opt/campusflow/deploy/oracle/backup-db.sh` |
| **Redéployer le frontend** | `git push` (auto) ou `npx vercel --prod` ; redéploiement obligatoire après toute modification d'une variable `VITE_*` |
| **Changer l'URL de l'API côté frontend** | Vercel → Settings → Environment Variables → `VITE_API_URL`, `VITE_WS_URL`, `VITE_BACKEND_DIRECT` → Redeploy |

### Diagnostic de panne (ordre recommandé)

1. `systemctl status campusflow-api` → service arrêté ? échecs répétés de `Restart=always` ? → voir les logs.
2. `journalctl -u campusflow-api -n 100 --no-pager` → erreur Python, `DATABASE_URL` invalide, port occupé…
3. `curl -i http://127.0.0.1:8000/health` → l'API répond-elle en local ?
4. `curl -i https://<API_DOMAIN>/health` → réponse via Nginx/TLS ? (sinon : Nginx, DNS, Security List)
5. `sudo nginx -t && systemctl status nginx` → configuration du proxy.
6. `sudo /opt/campusflow/.venv/bin/python /opt/campusflow/deploy/oracle/sqlite_util.py count /var/lib/campusflow/campusflow.db locations` → la base contient-elle des données ?
7. Côté navigateur : erreur CORS → comparer l'origine réelle (onglet Réseau) avec `CORS_ORIGINS` / `CORS_ORIGIN_REGEX` ; erreur 404 → vérifier la `VITE_API_URL` compilée dans le bundle.
8. `sudo tail -50 /var/log/nginx/campusflow-api.error.log` → 502 = Uvicorn arrêté, 504 = timeout.

---

## 10. Sécurité

| Mesure | État |
|---|---|
| `backend/.env` (secrets) | Non versionné (`.gitignore` : `.env`, `.env.*`), `chmod 600`, propriétaire `campusflow` |
| Gabarits versionnés | `backend/.env.example`, `backend/.env.production.example`, `frontend/.env.example`, `frontend/.env.production.example` → **placeholders `<...>` uniquement** (négation Git `!**/.env.*.example` ajoutée) |
| Secrets dans le code | Aucun : `JWT_SECRET` par défaut explicitement « à changer » ; contrôle `git ls-files` + `git check-ignore` effectué, **aucun secret détecté** |
| Rotation historique | Dépôt déjà nettoyé avant ce déploiement (`chore(security): untrack secrets…`, `rotation DB_PASSWORD`) |
| Exposition réseau | Seuls 22/80/443 ouverts (UFW + Security List). **Aucun** port de base de données (SQLite = fichier local, non exposable). Uvicorn `127.0.0.1:8000` privé |
| HTTPS | Let's Encrypt (certbot) + redirection HTTP → HTTPS + renouvellement automatique (`certbot.timer`) |
| Durcissement du service | `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=full`, `ProtectHome`, `ProtectKernel*`, `RestrictSUIDSGID`, `ReadWritePaths=/var/lib/campusflow` |
| En-têtes HTTP | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` (Nginx) ; HSTS via certbot (`--hsts`) |
| Endpoints sensibles | `/sensors/test-data` reste réservé aux administrateurs (code existant) — **aucun mécanisme de sécurité n'a été désactivé** |
| CORS | Liste blanche d'origines ; jamais `*` (incompatible avec `allow_credentials=True`) |
| Upload d'avatars | 5 Mo maximum, types MIME contrôlés, recompression WebP (code existant conservé) |
| Mots de passe DB / JWT | `JWT_SECRET` généré aléatoirement par `setup-vm.sh` s'il n'est pas fourni, jamais affiché en clair ; SQLite n'a pas de mot de passe (fichier `chmod 750`, propriétaire `campusflow`) |

---

## 11. Fichiers créés / modifiés

### Créés

| Fichier | Rôle |
|---|---|
| `deploy/oracle/setup-vm.sh` | Provisionnement complet de la VM (paquets système, venv, `.env`, base SQLite, migrations, seed, systemd, Nginx, UFW, certbot, tests) — ni PostgreSQL ni Redis |
| `deploy/oracle/deploy-backend.sh` | Mise à jour idempotente du backend (git pull → dépendances → contrôle SQLite → migrations → restart → health check ; la base et les médias, hors dossier de code, sont conservés) |
| `deploy/oracle/sqlite_util.py` | Utilitaires SQLite testables (stdlib) : `check` (intégrité), `count`, `backup` (copie transactionnelle cohérente), `restore`, `prune` (rotation) |
| `deploy/oracle/backup-db.sh` | Pilote `sqlite_util.py backup` + `prune` et contrôle la copie (`/var/backups/campusflow/campusflow-<date>.db`) |
| `deploy/oracle/campusflow-api.service` | Unité systemd (redémarrage auto, hardening, logs journald) |
| `deploy/oracle/nginx-campusflow-api.conf` | Vhost Nginx (proxy REST, WebSocket, médias, en-têtes de sécurité) |
| `backend/.env.production.example` | Gabarit des variables backend de production |
| `frontend/.env.production.example` | Gabarit des variables frontend de production |
| `frontend/vercel.json` | Configuration Vercel : framework Vite, `npm ci`, `dist`, rewrites SPA, cache des assets |
| `scripts/verify_deployment.py` | Vérification post-déploiement (API, base, CORS, frontend, absence de localhost, URL d'API compilée) |
| `docs/DEPLOIEMENT.md` | Ce guide |

### Modifiés

| Fichier | Modification |
|---|---|
| `backend/app/config.py` | Ajout de `CORS_ORIGIN_REGEX` (optionnel, vide par défaut) |
| `backend/app/main.py` | Prise en compte de `CORS_ORIGIN_REGEX` dans `CORSMiddleware` |
| `backend/Dockerfile` | **Correction du point d'entrée** : `main:app` (inexistant) → `app.main:app`, `--workers 1`, `EXPOSE 8000` |
| `frontend/src/services/sensorApi.js` | WebSocket : `VITE_WS_URL` → URL dérivée de `VITE_API_URL` en production → proxy en dev (plus de `wss://` vers le domaine Vercel) |
| `frontend/src/utils/avatar.js` | Médias : base backend absolue en production (plus de `127.0.0.1:8000` dans le build) ; comportement de développement inchangé |
| `frontend/src/services/authApi.js` | Replis `localhost` limités au développement, message d'erreur adapté en production, variable morte supprimée (ESLint) |
| `frontend/.gitignore` | Ligne d'exclusion `package-lock.json` retirée (le fichier était déjà suivi par Git) : plus d'ambiguïté sur la reproductibilité des builds Vercel |
| `.gitignore` | Négation `!**/.env.*.example` : autorise les gabarits, jamais un `.env` réel |

---

## 12. Ce qui reste à faire (nécessite les accès cloud)

1. **VM Oracle Cloud** : créer l'instance, ouvrir 80/443 dans la Security List, pointer le DNS, exécuter `setup-vm.sh` (§ 3).
2. **Vercel** : importer le dépôt (Root Directory `frontend`), définir les 4 variables `VITE_*`, déployer (§ 4).
3. **CORS** : renseigner `CORS_ORIGINS` avec le domaine Vercel réel, puis `sudo systemctl restart campusflow-api`.
4. **Vérification finale** : `python scripts/verify_deployment.py --api … --frontend … --origin …` + cocher la section 8.2.
5. **Documentation** : remplacer les placeholders `<API_DOMAIN>` et `<PROJET>.vercel.app` par les URLs réelles.

---

*CampusFlow — SUP'PTIC Yaoundé, Cameroun.*





