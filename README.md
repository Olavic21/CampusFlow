# CampusFlow Lite — SUP'PTIC Yaoundé

Application de visualisation des flux étudiants sur le campus de **SUP'PTIC** (École Supérieure des Postes et Télécommunications), Melen, Yaoundé, Cameroun.

```
CampusFlow/
├── frontend/     # React + Leaflet — carte interactive
├── backend/      # FastAPI — API congestion, flux, itinéraires
├── data/         # campus.json (38 bâtiments), capteurs, flux historique
└── ml/           # Modèle prédiction congestion
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
| `POST /auth/login` | Connexion |
| `POST /auth/logout` | Déconnexion |
| `GET /auth/me` | Profil utilisateur connecté |
| `POST /auth/refresh` | Renouveler les tokens |
| `GET /users/favorites/locations` | Favoris bâtiments |
| `GET /users/routes/history` | Historique itinéraires |
| `GET /sensors/mode` | Mode capteurs (simulation / api / mqtt / websocket) |
| `GET /sensors/status` | Dashboard IoT (capteurs actifs, lectures, sync) |
| `GET /sensors` | Liste des capteurs enregistrés |
| `POST /sensors/test-data` | Injecter une lecture test (ESP32, API) |
| `WS /ws/live-occupancy/` | Flux temps réel d'occupation |

> Pas de préfixe `/api` côté backend. Le frontend utilise `/api` via proxy Vite.

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
Carte & itinéraires (inchangés)
```

### Modes backend (`SENSOR_MODE`)

| Mode | Description |
|------|-------------|
| `simulation` | **Défaut** — moteur temps réel basé sur `capteurs.json` |
| `api` | Lectures injectées via HTTP |
| `mqtt` | Broker MQTT (`MQTT_BROKER_URL`) |
| `websocket` | Push via `/ws/live-occupancy/` |

### Endpoints IoT

| Route | Description |
|-------|-------------|
| `GET /sensors` | Liste des capteurs |
| `GET /sensors/status` | Dashboard IoT (actifs, lectures, sync) |
| `GET /sensors/mode` | Mode actuel (simulation / réel) |
| `POST /sensors/test-data` | Injecter une lecture test |
| `WS /ws/live-occupancy/` | Flux temps réel WebSocket |

### Frontend

- **Centre de supervision IoT** — menu navigation → IoT
- Badge **🟡 Mode Simulation** / **🟢 Données Réelles** sur la carte
- `VITE_SENSOR_MODE=api` (défaut) | `simulation` | `websocket`

Le simulateur backend écrit dans `sensor_readings` + `flux` toutes les 10 s (configurable via `SENSOR_SIM_INTERVAL_SEC`).

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

## Fonctionnalités carte

- 38 marqueurs colorés par congestion (Disponible → Saturé)
- Popup avec sparkline Recharts
- Itinéraire piéton Dijkstra (graphe < 120 m)
- Simulation temporelle 7h–19h
- Mode sombre, export PNG, alertes saturation
- Drawer historique 4 semaines

---

CampusFlow Lite — SUP'PTIC Yaoundé, Cameroun.
