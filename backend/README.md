# CampusFlow Lite — Backend

API REST FastAPI pour la congestion campus, le routage (NetworkX), la prédiction ML et les feedbacks. PostgreSQL pour la persistance, Redis pour le cache congestion (TTL ~60 s).

Les datasets et le schéma SQL vivent dans **`../data/`** (`schema.sql`, `load_postgres.py`). Le modèle ML est dans **`../ml/model.pkl`** (pas de dossier `backend/ml/` ni `backend/models/`).

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
| Framework | FastAPI | API REST, Swagger `/docs` |
| Base de données | PostgreSQL | Lieux, flux, schedules, feedbacks |
| Cache | Redis | Congestion temps réel |
| ORM | SQLAlchemy | Accès base (`SQLALCHEMY_DATABASE_URL`) |
| Algorithmique | NetworkX | Plus court chemin (Dijkstra) |
| ML | scikit-learn / joblib | `POST /predict` via `ML_MODEL_PATH` |
| Tests | pytest, fakeredis | SQLite mémoire, pas de Docker requis |

---

## Structure du projet

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py              # DATABASE_URL, SQLALCHEMY_DATABASE_URL, ML_MODEL_PATH…
│   ├── database/
│   │   ├── session.py
│   │   └── models.py
│   ├── schemas/
│   ├── routers/
│   ├── services/              # dont predict_service.py
│   └── utils/
├── tests/                     # pytest (conftest, test_*.py)
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md

../data/                       # CSV, schema.sql, load_postgres.py
../ml/model.pkl                # modèle pour /predict
```

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
| `DATABASE_URL` | URL PostgreSQL |
| `SQLALCHEMY_DATABASE_URL` | URL SQLAlchemy (si absent → `DATABASE_URL`) |
| `REDIS_URL` | Redis |
| `ML_MODEL_PATH` | Chemin vers `model.pkl` |
| `CORS_ORIGINS` | Origines frontend (ex. `http://localhost:5173`) |

Charger les données :

```bash
python data/load_postgres.py
```

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

| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Santé API |
| `GET` | `/locations` | Liste des lieux |
| `GET` | `/congestion` | Congestion (cache Redis) · `?location_id=` |
| `GET` | `/flux/live` | Flux récents · `?window=5` |
| `GET` | `/flux/history/{location_id}` | Historique · `?from=&to=&granularity=` |
| `GET` | `/path` | Itinéraire · `?from=&to=&avoid_congestion=` |
| `POST` | `/predict` | Prédiction ML |
| `GET` | `/feedbacks` | Feedbacks · filtres + pagination |
| `GET` | `/dashboard/stats` | Stats tableau de bord · `?period=week` |

### Exemple `POST /predict`

```json
{
  "location_id": 1,
  "datetime": "2026-05-15T14:00:00",
  "event_type": "cours"
}
```

```powershell
$body = @{ location_id = 1; datetime = "2026-05-15T14:00:00"; event_type = "cours" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8000/predict" -Method POST -ContentType "application/json" -Body $body
```

Réponses : **200**, **404** (lieu), **503** (modèle absent), **422** (JSON invalide).

---

## Données PostgreSQL

Schéma de référence : `data/db/schema.sql`. CSV : scripts dans `data/raw/`.

Le backend peut aussi créer les tables ORM au démarrage (`main.py`) ; en prod, privilégier `load_postgres.py` pour rester aligné avec les datasets.

---

## Tests

SQLite en mémoire + **fakeredis** (voir `tests/conftest.py`). Installer les deps de test si besoin :

```bash
pip install fakeredis httpx
```

```bash
cd backend
pytest tests/ -v
pytest tests/test_predict.py -v
```

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

CampusFlow Lite — Hackathon 2025.
