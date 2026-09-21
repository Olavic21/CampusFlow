# CampusFlow — Backend

API REST FastAPI pour la congestion campus, le routage (Dijkstra heapq, graphe piéton campus), les prévisions (profil horaire, SANS ML) et la supervision IoT. PostgreSQL pour la persistance, Redis pour le cache congestion (TTL 60 s), WebSocket pour le temps réel.

> Suite de tests reconstruite : **55 tests, 0 échec** (voir `backend/tests/README.md` et `backend/tests/`).
> RBAC (rôles student/staff/admin) + CRUD capteurs + incidents + prévisions 24h.
> `POST /sensors/test-data` maintenant protégé (admin only). Injection non autorisée par défaut.

Les datasets et le schéma SQL vivent dans **`../data/`** (`schema.sql`, `load_postgres.py`). Le modèle ML est dans **`../ml/model.pkl`** (optionnel, `/predict` derrière feature flag, 503 si absent).

---

## Table des matières

- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Installation](#installation)
- [Lancement](#lancement)
- [Endpoints API](#endpoints-api)
- [Données PostgreSQL](#données-postgresql)
- [Tests](#tests)
- [Bonnes pratiques](#bonnes-pratiques)
- [Dépannage](#dépannage)

---

## Stack technique

| Composant | Technologie | Usage |
| :--- | :--- | :--- |
| Framework | FastAPI | API REST, Swagger `/docs`, WebSocket |
| Base de données | PostgreSQL (+PostGIS optionnel) | Lieux, flux, incidents, capteurs, users |
| Cache | Redis | Congestion temps réel (TTL 60 s), cache API |
| ORM | SQLAlchemy 2 | Accès base (`SQLALCHEMY_DATABASE_URL`) |
| Algorithmique | heapq Dijkstra (custom) | Routage piéton (graphe campus, pas NetworkX) |
| Rôles | JWT claims + middleware FastAPI | RBAC (student/staff/admin) |
| IoT | Providers pluggables, paho-mqtt (v1) | Simulation / API / MQTT / WebSocket / Hybrid |
| Prévisions | Profil horaire historique (Agrégats) | `/forecast/occupancy` 24h (SANS ML) |
| Tests | pytest, fakeredis, httpx | SQLite mémoire, pas de Docker requis |

---

## Structure du projet

```text
backend/
├── app/
│   ├── main.py                 # FastAPI app, lifespan (seed, retention, scheduler)
│   ├── config.py              # Variables d'environnement (DATABASE_URL, JWT_*, SENSOR_*, MQTT_*, RETENTION_DAYS…)
│   ├── database/
│   │   ├── session.py         # SessionLocal, engine, Base
│   │   ├── models.py          # User (role), Location, Flux, Sensor, SensorReading, Incident, Favorite*, RouteHistory, Schedule, SensorHeartbeat
│   │   ├── init_db.py         # Création tables + seed bâtiments SUP'PTIC
│   │   └── schema.sql         # (référence PostgreSQL)
│   ├── schemas/               # Pydantic models (location, flux, sensors, auth, users, incidents, predict, forecast, admin)
│   ├── routers/
│   │   ├── main.py            # GET / → health
│   │   ├── auth.py            # register, login, logout, refresh, me
│   │   ├── users.py           # favorites (locations/routes), route_history
│   │   ├── profile.py         # GET/PATCH/DELETE profile, avatar
│   │   ├── locations.py       # GET /locations, GET /routing/status, GET /routing/alternatives, GET /routing/nearest-node, GET /next-departures
│   │   ├── path.py            # POST /path (itinéraire Dijkstra, profils)
│   │   ├── congestion.py      # GET /congestion (cache Redis)
│   │   ├── flux.py            # GET /flux/live, GET /flux/history/{id}, POST /flux (intégration)
│   │   ├── predict.py         # POST /predict (ML, 503 si modèle absent)
│   │   ├── forecast.py        # GET /forecast/occupancy, GET /occupancy/forecast
│   │   ├── sensors.py         # CRUD capteurs (RBAC), heartbeat, test-data (admin only), GET /sensors/mode, status
│   │   ├── incidents.py       # CRUD incidents (RBAC), impact routage
│   │   ├── dashboard.py       # GET /dashboard/stats
│   │   ├── admin.py           # GET /admin/health, GET /admin/users, PATCH /admin/users/{id}/role, POST /admin/clear-test-data
│   │   ├── feedbacks.py       # GET /feedbacks (démo, à compléter)
│   │   └── ws.py              # WebSocket /ws/live-occupancy/
│   ├── services/
│   │   ├── path_service.py    # Dijkstra heapq, graphe piéton campus, profils, incidents pénalisent
│   │   ├── congestion_service.py
│   │   ├── congestion_levels.py  # low/medium/high/critical, seuils 0.4/0.7/0.9
│   │   ├── campus_walkways.py    # Définition des allées campus (4 tronçons + jonctions)
│   │   ├── flux_service.py
│   │   ├── dashboard_service.py
│   │   ├── predict_service.py (ML, feature flag)
│   │   ├── forecast_service.py   # Prévision 24h par profil horaire (SANS ML)
│   │   ├── location_service.py
│   │   ├── data_quality.py       # Qualifier (REAL/SIM/TWIN/STALE/CACHED/PREDICTED)
│   │   ├── retention_service.py  # Purge 90j (au démarrage + toutes les 6h)
│   │   └── data_sources.py       # Fournisseurs de données (simulation, api, mqtt, websocket, hybrid)
│   ├── sensors/
│   │   ├── providers/         # BaseSensorProvider, SimulationProvider, APIProvider, MQTTProvider, WebSocketProvider, HybridProvider
│   │   ├── services/
│   │   │   ├── ingest.py      # Ingest unifiée (SensorReading + Flux + mise à jour capteur)
│   │   │   └── sensor_data_provider.py  # Provider factory, lecture unifiée par location
│   │   ├── mqtt/
│   │   │   └── client.py      # Client MQTT (paho v1, bridge thread-safe asyncio)
│   │   └── simulators/
│   │   │   └── engine.py      # Simulateur temps réel (tick 10s, variations matin/midi/après-midi/soir)
│   │   └── websocket/
│   │       └── hub.py         # Broadcast hub (occupancy, test-data sécurisé)
│   └── utils/
│       ├── security.py        # JWT decode/encode, require_role, roles constants
│       ├── redis_client.py   # Client Redis avec fallback gracieux
│       ├── errors.py         # HTTPException custom, handle_errors
│       ├── cache.py          # cache_get/set, invalidation par count/max_id
│       ├── seed.py           # Seed bâtiments SUP'PTIC (38) + données démo
│       └── ...
├── tests/                     # pytest (conftest, 14 fichiers test_*, 55 tests)
│   ├── conftest.py            # Fixtures DB (SQLite mémoire), client, auth, locations
│   ├── test_admin.py          # RBAC admin, CRUD users/capteurs/incidents
│   ├── test_congestion.py    # Niveaux congestion, seuils
│   ├── test_data_quality.py  # Qualification données
│   ├── test_dashboard.py     # Stats dashboard
│   ├── test_flux.py          # Flux live, historique
│   ├── test_incidents.py     # CRUD incidents, impact routage
│   ├── test_intelligence.py  # Prévision 24h (profil horaire)
│   ├── test_locations.py     # Locations, routing status
│   ├── test_path.py          # Itinéraires Dijkstra, profils, incidents
│   ├── test_predict.py       # Prédiction ML (mock)
│   ├── test_rbac.py          # Rôles, permissions, injection protégée
│   ├── test_sensor_crud.py   # CRUD capteurs, heartbeat, duplicate
│   ├── test_sensors.py       # Sensors, test-data auth, dashboard IoT
│   └── test_services.py      # Services isolés
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── requirements.txt           # Dépendances production (fastapi, sqlalchemy, redis, paho-mqtt…)
├── requirements-dev.txt       # Dépendances dev/test (fakeredis, httpx, pytest)
└── README.md
```

`../data/` — CSV, `schema.sql`, `load_postgres.py` (référence PostgreSQL)
`../ml/model.pkl` — modèle ML pour `/predict` (optionnel, LFS)
`../ml/` — modèle prédiction (optionnel)

---

## Installation

Depuis la **racine du monorepo** :

```bash
python -m venv .venv
.\.venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Configurer le backend :

```bash
cd backend
copy .env.example .env            # Windows
# cp .env.example .env            # Linux / macOS
```

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | URL PostgreSQL (ou SQLite `sqlite:///./campusflow.db`) |
| `SQLALCHEMY_DATABASE_URL` | URL SQLAlchemy (si absent → `DATABASE_URL`) |
| `REDIS_URL` | Redis (pour cache congestion + API) |
| `ML_MODEL_PATH` | Chemin vers `model.pkl` (optionnel, `/predict` 503 si absent) |
| `CORS_ORIGINS` | Origines frontend (ex. `http://localhost:5173`) |
| `JWT_SECRET` | Secret JWT (32+ caractères en production, changer depuis `.env.example`) |
| `JWT_ACCESS_MINUTES` | Durée token accès (défaut 60) |
| `JWT_REFRESH_DAYS` | Durée token refresh (défaut 30) |
| `SENSOR_MODE` | `simulation` (défaut) / `api` / `mqtt` / `websocket` / `hybrid` |
| `SENSOR_SIM_INTERVAL_SEC` | Intervalle simulateur (défaut 10 s) |
| `MQTT_BROKER_URL` | Broker MQTT (ex. `mqtt://localhost:1883`, optionnel) |
| `MQTT_TOPIC` | Topic MQTT (ex. `campusflow/occupancy/#`, optionnel) |
| `RETENTION_DAYS` | Rétention données flux/sensor_readings (défaut 90 j) |
| `MEDIA_ROOT` | Dossier avatars (défaut `../media`) |
| `MEDIA_URL` | URL service avatars (défaut `/media`) |
| `MAINTENANCE_MODE` | `true` → API en maintenance (headers + messages) |

Charger les données :

```bash
python -m app.utils.seed     # SQLite : crée tables + 38 bâtiments SUP'PTIC + seed incidents
# ou
python data/load_postgres.py  # PostgreSQL : charge depuis CSV
```

> `python -m app.utils.seed` suffit pour le dev local (SQLite). Il crée automatiquement les tables ORM au démarrage.

---

## Lancement

### Local (recommandé en dev)

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API : [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Swagger : [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

> Lancer **depuis `backend/`** pour éviter `ModuleNotFoundError: No module named 'app'`.

### Docker Compose

```bash
cd backend
docker compose up --build
```

Adapter `.env` pour les hôtes Docker (`db`, `redis`) — voir les lignes commentées dans `.env.example`.

---

## Endpoints API

**Base URL :** `http://localhost:8000`
**Swagger :** [http://localhost:8000/docs](http://localhost:8000/docs)

### Auth (public)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Inscription (email, nom, mot de passe) → rôle `student` |
| `POST` | `/auth/login` | Connexion → `access_token` + `refresh_token` |
| `POST` | `/auth/logout` | Déconnexion (client-side : supprimer tokens) |
| `POST` | `/auth/refresh` | Renouveler `access_token` avec `refresh_token` |
| `GET`  | `/auth/me` | Profil connecté (vérifie token) |

### Profil (authentifié)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET`  | `/profile` | Profil complet (nom, email, avatar, préférences) |
| `PATCH`| `/profile` | Modifier nom/préférences |
| `POST` | `/profile/avatar` | Upload avatar (JPG/PNG/WebP, max 5 Mo) → `/media/avatars/{id}.webp` |
| `DELETE`| `/profile/avatar` | Supprimer avatar |

### Utilisateurs (authentifié, staff+)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET`  | `/users/favorites/locations` | Favoris bâtiments |
| `GET`  | `/users/favorites/routes` | Favoris itinéraires |
| `GET`  | `/users/routes/history` | Historique itinéraires |
| `PATCH`| `/users/{id}/role` | Changer rôle (admin only) |

### Lieux + Routage (public)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET`  | `/locations` | Liste 38 bâtiments SUP'PTIC · `?type=` |
| `GET`  | `/routing/status` | État routage RTCM (occupation, incidents actifs) |
| `GET`  | `/routing/alternatives?from=&to=&profile=` | Itinéraires alternatifs (rapide/calme/PMR) |
| `GET`  | `/routing/nearest-node?lat=&lon=` | Snap GPS → nœud graphe (pour navigation) |
| `GET`  | `/next-departures?location_id=&hours=2` | Prochains départs depuis horaires |
| `POST` | `/path` | Itinéraire piéton Dijkstra · body `{from, to, profile?, stops?}` |

### Congestion + Flux (public)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET`  | `/congestion` | Niveaux congestion par salle · `?location_id=` (cache Redis 60 s) |
| `GET`  | `/flux/live` | Flux récents · `?window=5` (moyenne sur fenêtre) |
| `GET`  | `/flux/history/{location_id}` | Historique agrégé · `?from=&to=&granularity=hour` |
| `POST` | `/flux` | Injection flux (staff+, pour test/futur API capteurs) |

### Prévisions (public)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET`  | `/forecast/occupancy?location_id=` | Prévision 24 h (profil horaire, qualifié `PREDICTED`, bande min/max, taux échantillonnage) |
| `GET`  | `/occupancy/forecast?location_id=&hour=` | Occupation prévue à H+1/H+2 pour une salle |

### IoT / Capteurs (public + RBAC)
| Méthode | Route | Description | Permissions |
| :--- | :--- | :--- | :--- |
| `GET`  | `/sensors` | Liste capteurs (CRUD) | authentifié |
| `POST` | `/sensors` | Créer capteur (name, location_id, type, source, role) | staff+ |
| `GET`  | `/sensors/{id}` | Détails capteur + dernières lectures | authentifié |
| `PATCH`| `/sensors/{id}` | Modifier capteur | staff+ |
| `DELETE`| `/sensors/{id}` | Supprimer capteur | admin only |
| `POST` | `/sensors/{id}/heartbeat` | Heartbeat → `last_seen` mis à jour, `status` → online si Redis actif | staff+ (public accepté pour compatibilité) |
| `GET`  | `/sensors/mode` | Mode actuel (simulation/api/mqtt/websocket/hybrid) | public |
| `GET`  | `/sensors/status` | Dashboard IoT (compteurs, dernières sync, detection offline) | public |
| `POST` | `/sensors/test-data` | Injecter lecture test (location_id, occupancy, confidence, sensor_id) | **admin only** ⚠️ |

> `POST /sensors/test-data` était public → maintenant **PROTÉGÉ (admin only)** depuis l'audit (P0-1).
> Le mode `hybrid` : les bâtiments sans capteur réel utilisent la simulation automatiquement.

### Incidents (public + RBAC)
| Méthode | Route | Description | Permissions |
| :--- | :--- | :--- | :--- |
| `GET`  | `/incidents` | Liste incidents (ouvert/fermé, par zone, filtrable par type) | public |
| `GET`  | `/incidents/active` | Incidents actifs (pour carte + routage) | public |
| `POST` | `/incidents` | Créer incident (type, zone_type, location_id, description, starts_at, ends_at, severity) | staff+ |
| `PATCH`| `/incidents/{id}` | Mettre à jour (ouvrir/fermer/modifier durée) | staff+ |
| `DELETE`| `/incidents/{id}` | Supprimer | admin only |

Impact routage : les zones avec incident actif (`is_active=true`) pénalisent fortement les itinéraires (poids → ∞).

### Dashboard (public)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET`  | `/dashboard/stats` | Stats globales · `?period=week` (occupants moyens, taux saturation, top salles, compteurs IoT) |

### WebSocket
| Route | Description |
| :--- | :--- |
| `WS /ws/live-occupancy/` | Flux temps réel d'occupation (snapshot à connexion + push batch) · ping 60 s · reconnexion automatique |

### Admin (admin only)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET`  | `/admin/health` | Santé détaillée (maintenance_mode, db, redis, compteurs: users/sensors/incidents/readings/critical_sensors) |
| `GET`  | `/admin/users` | Liste utilisateurs (id, nom, email, rôle, created_at) avec pagination |
| `PATCH`| `/admin/users/{id}/role` | Modifier rôle (student/staff/admin) |
| `POST` | `/admin/clear-test-data` | Purger les lectures test (reset compteurs IoT dashboard) |

### Anticiper / ML (public, optionnel)
| Méthode | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/predict` | Prédiction ML (model.pkl) · body `{location_id, datetime, event_type?}` · réponses 200/404/503/422 |

> `/predict` existe (modèle scikit-learn joblib) mais n'est **pas utilisé par le frontend**.
> Les prévisions utilisateur passent par `/forecast/occupancy` (profil horaire, SANS ML inutile).

---

## Données PostgreSQL

Schéma de référence : `data/db/schema.sql`. CSV : scripts dans `data/raw/`.

Le backend peut aussi créer les tables ORM au démarrage (`main.py`) ; en prod, privilégier `load_postgres.py` pour rester aligné avec les datasets.

---

## Tests

Suite reconstruite : **14 fichiers, 55 tests, 0 échec** (voir `tests/README.md`).

SQLite en mémoire + **fakeredis** (voir `tests/conftest.py`). Installer les deps de test si besoin :

```bash
pip install -r requirements-dev.txt   # fakeredis, httpx, pytest
# ou manuellement
pip install fakeredis httpx
```

```bash
cd backend
pytest tests/ -v            # tous les tests
pytest tests/test_path.py -v    # tests routage
pytest tests/test_rbac.py -v    # tests permissions
pytest tests/test_sensor_crud.py -v  # tests CRUD capteurs
pytest tests/test_incidents.py -v    # tests incidents
pytest tests/test_intelligence.py -v # tests prévisions 24h
```

Pour exécuter depuis la racine du monorepo :

```bash
python -m pytest backend/tests/ -v
```

### Couverture

| Domaine | Fichiers | Tests |
| :--- | :--- | :--- |
| Auth + RBAC | `test_rbac.py`, `test_admin.py` | 14 |
| Capteurs IoT | `test_sensors.py`, `test_sensor_crud.py` | 14 |
| Incidents | `test_incidents.py` | 9 |
| Routage | `test_path.py`, `test_locations.py` | 7 |
| Congestion | `test_congestion.py` | 6 |
| Flux | `test_flux.py` | 5 |
| Prévisions | `test_intelligence.py` | 5 |
| Dashboard | `test_dashboard.py`, `test_data_quality.py` | 9 |
| Predict (ML) | `test_predict.py` | 3 |
| Services | `test_services.py` | 3 |
| **Total** | **14 fichiers** | **55 tests** |

---

## Bonnes pratiques

- Validation Pydantic (`schemas/`)
- Erreurs centralisées (`utils/errors.py`)
- Cache Redis sur la congestion
- Logique dans `services/`, routes fines dans `routers/`
- Config via `.env`, pas de secrets en dur

---

## Dépannage

| Problème | Solution |
| :--- | :--- |
| `No module named 'app'` | `cd backend` puis relancer uvicorn |
| Chemin Windows / `$env:ML_MODEL_PATH` | Guillemets simples : `'C:/.../ml/model.pkl'` |
| `503` sur `/predict` | Vérifier `ML_MODEL_PATH` et `Test-Path` sur le `.pkl` |
| Connexion DB | PostgreSQL démarré, `DATABASE_URL` / `SQLALCHEMY_DATABASE_URL` corrects |
| Endpoints vides | Charger les données (`load_postgres.py` ou `seed.py`) |
| Redis | Service healthy : `docker compose ps` |
| Tests `ImportError` | `pip install fakeredis httpx` |

---

CampusFlow — SUP'PTIC Yaoundé, Cameroun.
