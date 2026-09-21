# CampusFlow — Smart Campus & Intelligent Campus Mobility

Application de visualisation des flux, localisation, navigation et intelligence campus pour **SUP'PTIC** (École Supérieure des Postes et Télécommunications), Melen, Yaoundé, Cameroun.

> Audit complet + roadmap réalisés ( voir [`docs/audit-roadmap.md`](docs/audit-roadmap.md) ).
> Suite de tests backend reconstruite (55 tests, 0 échec). Qualité des données qualifiée (REAL/SIM/TWIN/STALE).
> **Déploiement production : Vercel (frontend) + Oracle Cloud (backend) → [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md)**

```
CampusFlow/
├── frontend/     # React 19 + Vite 8 + Tailwind + Leaflet — carte, navigation GPS, console admin
├── backend/      # FastAPI — API routes, IoT, routage, prévisions, RBAC
├── data/         # campus.json (38 bâtiments), capteurs, flux historique, schema.sql
├── ml/           # Modèle prédiction (optionnel, gardé derrière feature flag)
├── deploy/       # Déploiement Oracle Cloud (setup-vm.sh, systemd, Nginx, sauvegarde DB)
├── docs/         # Documentation + rapport d'audit + guide de déploiement
├── scripts/      # Build APK, restart backend, vérification de déploiement, SDK Android...
└── android/      # Projet Capacitor (généré)
```

**Centre campus :** `3.8691°N, 11.5083°E` — zoom 18

---

## Démarrage rapide (5 minutes)

### 1. Générer les données SUP'PTIC

```bash
cd data/raw
python generate_campusflow_data.py
```

Produit : `campus.json` (38 bâtiments), `capteurs.json`, `frequentation.csv`, `flux historique.csv`.

### 2. Backend (SQLite — sans Docker)

```bash
# À la racine du projet (avec le venv activé)
pip install -r requirements.txt

cd backend
copy .env.example .env          # Windows
python -m app.utils.seed        # Charge 38 bâtiments + flux récents
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Si l'inscription affiche « délai dépassé »** : le processus sur le port 8000 est souvent bloqué. Redémarrez l'API :

```powershell
# Si erreur « No module named bcrypt » une seule fois :
.\scripts\install-backend-deps.ps1

# Puis demarrer l'API :
.\scripts\restart-backend.ps1
```

Puis vérifiez : http://127.0.0.1:8000/health doit répondre `{"status":"ok"}` en moins d'une seconde.

- API : http://127.0.0.1:8000
- Swagger : http://127.0.0.1:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

- App : http://localhost:5173
- Le proxy Vite redirige `/api/*` → backend `:8000`

### 4. Vérifier les APIs

```bash
cd backend
python scripts/verify_api.py
```

---

## Endpoints API

| Route | Description |
|-------|-------------|
| `GET /health` | Santé |
| `GET /locations` | 38 bâtiments SUP'PTIC |
| `GET /flux/live?window=60` | Fréquentation temps réel |
| `GET /flux/history/{id}` | Historique par bâtiment |
| `GET /congestion` | Niveaux de congestion |
| `GET /path?from=1&to=8` | Itinéraire piéton (Dijkstra) |
| `GET /dashboard/stats` | Stats globales |
| `POST /predict` | Prédiction ML |
| `GET /feedbacks` | Retours étudiants |
| `POST /auth/register` | Inscription (JWT) |
| `GET /auth/me` | Profil utilisateur connecté |
| `POST /auth/refresh` | Renouveler les tokens |
| `GET /users/favorites/locations` | Favoris bâtiments |
| `GET /users/favorites/routes` | Favoris itinéraires |
| `GET /users/routes/history` | Historique itinéraires |
| `PATCH /users/{id}/role` | Changer rôle (admin only) |
| `GET /sensors/mode` | Mode capteurs (simulation / api / mqtt / websocket / hybrid) |
| `GET /sensors/status` | Dashboard IoT (capteurs actifs, lectures, sync) |
| `GET /sensors` | Liste des capteurs enregistrés (CRUD) |
| `POST /sensors` | Créer un capteur (staff+) |
| `PATCH /sensors/{id}` | Modifier un capteur (staff+) |
| `DELETE /sensors/{id}` | Supprimer un capteur (admin only) |
| `POST /sensors/{id}/heartbeat` | Heartbeat capteur (détection offline) |
| `POST /sensors/test-data` | Injecter une lecture test — **PROTÉGÉ (admin only)** |
| `WS /ws/live-occupancy/` | Flux temps réel d'occupation |
| `GET /incidents` | Liste des incidents (fermetures zones) |
| `POST /incidents` | Créer un incident (staff+) |
| `PATCH /incidents/{id}` | Mettre à jour (ouvrir/fermer) |
| `GET /routing/status` | État routage temps réel (RTCM) |
| `GET /routing/alternatives?from=&to=` | Itinéraires alternatifs |
| `GET /routing/nearest-node?lat=&lon=` | Snap GPS → nœud graphe |
| `GET /next-departures?location_id=` | Prochains départs (horaires) |
| `GET /forecast/occupancy?location_id=` | Prévision occupation 24 h (PREDICTED) |
| `GET /occupancy/forecast?location_id=&hour=` | Occupation prévue à H+1/H+2 |
| `GET /dashboard/stats` | Stats globales (état campus) |
| `GET /admin/health` | Santé détaillée (admin only) |
| `GET /admin/users` | Liste utilisateurs (admin only) |
| `PATCH /admin/users/{id}/role` | Modifier rôle utilisateur (admin only) |
| `POST /admin/clear-test-data` | Purger les lectures test (admin only) |
| `GET /health` | Santé |

> **Changement important** : `POST /sensors/test-data` est maintenant protégé (admin only). Tout le monde ne peut plus injecter de données.
>
> Pas de préfixe `/api` côté backend. Le frontend utilise `/api` via proxy Vite.

### Qualité des données — source qualifiée

Chaque donnée affichée porte maintenant une **source** :

| Source | Signification | Badge |
|--------|---------------|-------|
| `REAL` | Capteur physique (MQTT/HTTP) | 🟢 |
| `SIMULATED` | Moteur de simulation backend | 🟡 |
| `TWIN` | Données du jumeau numérique (démo) | ⚪ |
| `PREDICTED` | Prévision (profil horaire) | 🔮 |
| `CACHED` | Cache Redis (obsolète possible) | ⏱ |
| `STALE` | Pas de données récentes | ⚠️ |

Badges visibles sur : carte (marqueurs), fiches bâtiments, dashboard IoT, statistiques.

### Architecture IoT (sensor-ready)

CampusFlow Lite utilise une couche d'abstraction : l'application ne sait pas si les données viennent de `capteurs.json`, d'une API ou d'un capteur physique.

```
capteurs.json / ESP32 / MQTT
        ↓
SensorDataProvider (backend)
        ↓
/flux/live + /ws/live-occupancy/
        ↓
Frontend (aucune modification lors du passage aux capteurs réels)
```

**Mode par défaut** : `SENSOR_MODE=simulation` (backend `.env`)

| Variable backend | Valeurs | Rôle |
|------------------|---------|------|
| `SENSOR_MODE` | `simulation`, `api`, `mqtt`, `websocket` | Source des données |
| `SENSOR_SIM_INTERVAL_SEC` | ex. `10` | Intervalle du simulateur |
| `CAPTEURS_JSON_PATH` | chemin vers `capteurs.json` | Baseline simulation |
| `MQTT_BROKER_URL` | ex. `mqtt://localhost:1883` | Broker ESP32 |
| `MQTT_TOPIC` | ex. `campusflow/occupancy/#` | Topic MQTT |

**Frontend** : `VITE_SENSOR_MODE=api` (recommandé) — consomme `/flux/live` et WebSocket `/ws/live-occupancy/`.

**Écrans IoT** :
- Badge **Mode Simulation** / **Données Réelles** sur la carte
- **Centre de supervision IoT** (menu IoT) — tableau des capteurs
- **Dashboard** — métriques capteurs actifs, lectures, dernière sync

**Test d'injection** (Swagger ou curl) :

```bash
curl -X POST http://127.0.0.1:8000/sensors/test-data \
  -H "Content-Type: application/json" \
  -d '{"building_id": 8, "occupancy": 17, "confidence_score": 0.95}'
```

**Payload MQTT** (futur ESP32) :

```json
{"building_id": 8, "occupancy": 17, "confidence_score": 0.95, "sensor_id": 1}
```

### Authentification

1. Copier `backend/.env.example` → `backend/.env` et définir `JWT_SECRET`.
2. Au démarrage, FastAPI crée les tables `users`, `user_preferences`, `favorite_*`, `route_history`.
3. Le frontend stocke `access_token` / `refresh_token` dans `localStorage` pour rester connecté.
4. Pages **Connexion** / **Inscription** (Framer Motion) ; menu utilisateur avec avatar et **Déconnexion**.
5. Dev sans auth : `VITE_SKIP_AUTH=true` dans `frontend/.env`.

Les logs auth s'affichent dans la console backend (`Registration started`, `Login success`, etc.).

### Photo de profil

- `GET /profile` — profil complet
- `POST /profile/avatar` — upload (JPG/PNG/WebP, max 5 Mo, compression WebP)
- `DELETE /profile/avatar` — suppression
- Fichiers servis sous `/media/avatars/`

Installer Pillow : `pip install Pillow` (inclus dans `requirements.txt`).

### Performances

- Cache API : bâtiments (120 s), congestion (30 s), health check frontend (20 s).
- Dijkstra : file de priorité (tas) au lieu d'un scan linéaire.
- Occupation : couleurs/statuts pré-calculés via `useMemo`.
- Marqueurs carte : `React.memo` avec comparateur ciblé.

---

## Déploiement en production — Vercel (frontend) + Oracle Cloud (backend)

Guide complet : **[`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md)** (architecture, réseau, HTTPS, migrations, CORS, tests, maintenance).

```bash
# Backend — sur la VM Oracle Cloud (Ubuntu), depuis /opt/campusflow
sudo GIT_REF=mobile-release \
     API_DOMAIN=api-campusflow.<domaine> \
     LETSENCRYPT_EMAIL=vous@example.com \
     CORS_ORIGINS=https://<projet>.vercel.app \
     bash deploy/oracle/setup-vm.sh        # PostgreSQL+PostGIS, systemd, Nginx, HTTPS, seed

# Frontend — Vercel : Root Directory = frontend
#   VITE_API_URL=https://api-campusflow.<domaine>
#   VITE_WS_URL=wss://api-campusflow.<domaine>
#   VITE_BACKEND_DIRECT=https://api-campusflow.<domaine>
#   VITE_SENSOR_MODE=api

# Vérification réelle après déploiement (API, base, CORS, frontend, absence de localhost)
python scripts/verify_deployment.py --api https://<API_DOMAIN> \
    --frontend https://<projet>.vercel.app --origin https://<projet>.vercel.app
```

---

## Production PostgreSQL

```bash
# Docker
cd backend && docker compose up -d

# Charger les données
python data/load_postgres.py
```

Configurer `.env` avec `DATABASE_URL=postgresql://...`

---

## Architecture IoT (Sensor Ready)

CampusFlow est prêt pour de vrais capteurs (ESP32, MQTT, RFID, etc.) sans refonte du frontend.

### Principe

```
capteurs.json / ESP32 / MQTT / API
        ↓
SensorDataProvider (backend + frontend)
        ↓
/flux/live + /ws/live-occupancy/
        ↓
Carte & itinéraires (inchangés)
```

### Modes backend (`SENSOR_MODE`)

| Mode | Description |
|------|-------------|
| `simulation` | Moteur temps réel basé sur `capteurs.json` (défaut) |
| `api` | Lectures injectées via HTTP |
| `mqtt` | Broker MQTT (`MQTT_BROKER_URL`) |
| `websocket` | Push via `/ws/live-occupancy/` |
| `hybrid` | Réel + simulation : les bâtiments sans capteur utilisent la simulation (recommandé pour transition) |

### Nouveau : RBAC (rôles + permissions)

| Rôle | Permissions |
|------|-------------|
| `student` (défaut) | Lecture seule, favoris, itinéraires |
| `staff` | + CRUD incidents, CRUD capteurs, injection test |
| `admin` | + CRUD utilisateurs, suppression capteurs, clear test data, monitoring |

`POST /sensors/test-data` est maintenant **PROTÉGÉ (admin only)**.

### Nouveau : Incidents (fermetures de zones)

Les incidents permettent de fermer des zones (salle, bâtiment, allée) temporairement.

| Endpoint | Description |
|----------|-------------|
| `GET /incidents` | Liste (ouvert/fermé, par zone) |
| `POST /incidents` | Créer (type, zone, heure début/fin) |
| `PATCH /incidents/{id}` | Ouvrir / fermer / modifier |

Impact routage : les zones fermées pénalisent fortement les itinéraires (score → ∞).

### Nouveau : Prévisions (SANS ML)

`GET /forecast/occupancy?location_id=` retourne l'occupation prévue sur 24h par **profil horaire historique** (déterministe, explicable, qualifié `PREDICTED`).

> Le modèle ML (`ml/model.pkl`) est conservé mais non utilisé par les écrans. `/predict` existe encore (503 si fichier absent).

### Endpoints IoT

| Route | Description |
|-------|-------------|
| `GET /sensors` | Liste des capteurs (CRUD) |
| `POST /sensors` | Créer un capteur (staff+) |
| `PATCH /sensors/{id}` | Modifier (staff+) |
| `DELETE /sensors/{id}` | Supprimer (admin only) |
| `POST /sensors/{id}/heartbeat` | Heartbeat → détection offline |
| `GET /sensors/status` | Dashboard IoT |
| `GET /sensors/mode` | Mode actuel |
| `POST /sensors/test-data` | Injecter lecture test (**admin only**) |
| `WS /ws/live-occupancy/` | Flux temps réel |

### Backend IoT

| Variable | Valeurs | Rôle |
|----------|---------|------|
| `SENSOR_MODE` | `simulation`, `api`, `mqtt`, `websocket`, `hybrid` | Source des données |
| `SENSOR_SIM_INTERVAL_SEC` | ex. `10` | Intervalle du simulateur |
| `MQTT_BROKER_URL` | ex. `mqtt://localhost:1883` | Broker ESP32 (paho-mqtt, dans requirements) |
| `MQTT_TOPIC` | ex. `campusflow/occupancy/#` | Topic MQTT |

**Frontend** : `VITE_SENSOR_MODE=api` (recommandé).

### Écrans IoT

- Badge source par bâtiment sur la carte (🟢 REAL / 🟡 SIMULATED / ⚪ TWIN)
- **Supervision IoT** (menu admin) : tableau capteurs, CRUD, heartbeat, statut online/offline
- **Dashboard** : métriques capteurs actifs, lectures, dernière sync, détection offline
- **Badges prévision** sur fiches bâtiments (🔮 PREDICTED + intervalle min/max)

### Rétention des données

Le simulateur écrit ~76 lignes/10 s. Sans purge, la DB gonfle (~650 k lignes/jour en SQLite).

Rétention configurée : **90 jours** (`RETENTION_DAYS` dans `.env`).

- Purge au démarrage du backend (`retention_service.py`)
- Purge périodique toutes les 6h (asyncio background task)
- Tables impactées : `sensor_readings`, `flux`

### Authentification

1. Copier `backend/.env.example` → `backend/.env` et définir `JWT_SECRET` (32+ caractères en production).
2. Au démarrage, FastAPI crée les tables (`users` avec `role`, `user_preferences`, `favorite_*`, `route_history`, `incidents`, `sensor_heartbeats`).
3. Le frontend stocke `access_token` / `refresh_token` dans `localStorage`.
4. Pages **Connexion** / **Inscription** ; menu utilisateur avec avatar et **Déconnexion**.
5. Dev sans auth : `VITE_SKIP_AUTH=true` dans `frontend/.env`.

Rôles par défaut : les nouveaux utilisateurs sont `student`. Pour créer un admin, utiliser l'endpoint `PATCH /admin/users/{id}/role` (admin only) ou modifier directement en DB.

Les logs auth s'affichent dans la console backend (`Registration started`, `Login success`, etc.).

### Photo de profil

- `GET /profile` — profil complet
- `POST /profile/avatar` — upload (JPG/PNG/WebP, max 5 Mo, compression WebP)
- `DELETE /profile/avatar` — suppression
- Fichiers servis sous `/media/avatars/`

Installer Pillow : `pip install Pillow` (déjà dans `requirements.txt`).

### Performance

- Cache API : bâtiments (120 s), congestion (60 s), flux live (15 s).
- Dijkstra : file de priorité (tas) au lieu d'un scan linéaire.
- Occupation : couleurs/statuts pré-calculés via `useMemo`.
- Marqueurs carte : `React.memo` avec comparateur ciblé.
- WebSocket-first : poll 30 s désactivé quand WS connecté (réduction réseau).

---

## Mode hors ligne

Si le backend est indisponible, le frontend charge automatiquement :
- `frontend/src/data/campus.json`
- `frontend/src/data/capteurs.json`
- `frontend/src/data/frequentation.csv`

Un badge **« Mode hors ligne »** s'affiche.

---

## Application mobile Android (APK)

CampusFlow Lite est **mobile-first** avec Capacitor 8. Le build APK **sans Android Studio** est supporté via des scripts PowerShell.

**Navigation mobile** : Carte · Bâtiments · Itinéraires · Statistiques · Profil

### Prérequis (une fois)

- **JDK 17+** dans le `PATH` (`java -version`)
- **Android SDK** (command line tools uniquement) — voir [`docs/mobile/INSTALLATION.md`](docs/mobile/INSTALLATION.md)
- **Node.js** + `npm install` dans `frontend/`

### Build APK sans Android Studio (Windows)

```powershell
# 1. Installer le SDK Android (si pas encore fait)
.\scripts\install-android-sdk.ps1

# 2. Backend accessible depuis le telephone (meme reseau Wi-Fi)
.\scripts\restart-backend.ps1 -Lan
# (depuis backend/ : .\scripts\restart-backend.ps1 -Lan — meme script via redirection)

# 3. Build APK (detecte IP LAN + sync Capacitor + Gradle)
.\scripts\build-apk-cli.ps1 -DetectIp
```

APK genere :

- `frontend\android\app\build\outputs\apk\debug\app-debug.apk`
- Copie : `CampusFlow-lite-debug.apk` (racine du projet)

**Alternative** depuis `frontend/` : `npm run build:apk`

### Configuration reseau APK

L'APK ne peut pas appeler `127.0.0.1`. Le script `prepare-apk-env.ps1` copie `frontend/.env.apk` vers `frontend/.env` avec l'IP LAN du PC :

```powershell
.\scripts\prepare-apk-env.ps1 -DetectIp
# ou manuellement : editer frontend/.env.apk puis copier vers .env
```

Backend : `CORS_ORIGINS` doit inclure `https://localhost` (deja dans `backend/.env.example`).

### Avec Android Studio (optionnel)

```bash
cd frontend
npm run cap:sync
npm run cap:android
```

| Livrable | Commande |
|----------|----------|
| APK Debug | `.\scripts\build-apk-cli.ps1 -DetectIp` |
| APK Release | `gradlew assembleRelease` (voir `docs/mobile/`) |
| AAB Play Store | `gradlew bundleRelease` |

Documentation complete : [`docs/mobile/INSTALLATION.md`](docs/mobile/INSTALLATION.md)

---

## Fonctionnalités

### Carte
- 38 bâtiments SUP'PTIC avec marqueurs colorés par congestion (🟢 Disponible → 🔴 Saturé)
- Badge source par bâtiment (🟢 REAL / 🟡 SIMULATED / ⚪ TWIN / 🔮 PREDICTED / ⏱ CACHED / ⚠️ STALE)
- Sparkline live via `/flux/history` (pas plus de CSV statiques 2024)
- Itinéraire piéton Dijkstra (graphe piéton campus, threads d'allées)
- Simulation temporelle 7h–19h (mode démo explicite)
- Mode sombre complet, favicon, badge campus

### Navigation
- **Navigation GPS** : watchPosition, snap-to-node, progression, recalcul à l'écart
- **Profils d'itinéraire** : Le plus rapide / Éviter l'affluence / Accessible PMR
- **Alternatives** : itinéraires alternatifs (penalty-seeded)
- **Arrêt/point intermédiaire** : itinéraires multi-points
- **Arrivée** : enregistrer en favori

### Recherche
- Recherche par nom / code
- Filtres : catégorie, "libre maintenant"
- Tri par affluence

### Données temps réel
- Occupation live qualifiée (REAL/SIMULATED/TWIN)
- Détection STALE (pas de données > 2× intervalle)
- WebSocket-first (poll 30s désactivé quand WS connecté)
- Statistiques globales (état campus, bannière mobile)

### Smart Mobility
- **Incidents** : fermetures de zones (salle, bâtiment, allée) — impact routage
- **Prévisions** : occupation 24h par profil horaire (PREDICTED, SANS ML inutile)
- **Salle libre maintenant** : recherche favorisant les espaces disponibles
- **Prochains départs** : depuis horaires (schedules)

### Utilisateur
- Auth JWT (access 60 min / refresh 30 j)
- Rôles : student (défaut) / staff / admin
- Favoris lieux + itinéraires
- Historique itinéraires
- Avatar (camera/gallery, WebP compression)
- Alertes saturation favoris (notifications locales Capacitor)

### Administration (menu Admin, role≥staff)
- **Dashboard** : santé campus, compteurs
- **Capteurs** : CRUD, heartbeat, détection offline, mode hybride
- **Incidents** : CRUD, statut ouvert/fermé
- **Utilisateurs** : liste, modifier rôle
- **Monitoring** : `/admin/health` (maintenance mode, DB, Redis, counts)

### IoT
- Providers pluggables : simulation / api / mqtt / websocket / hybrid
- CRUD capteurs (staff+)
- Heartbeat → détection offline automatique
- Injection test sécurisée (admin only)
- Rétention 90 jours (purge automatique)
- MQTT : paho-mqtt dans requirements (bridge thread-safe)

---

CampusFlow — SUP'PTIC Yaoundé, Cameroun.