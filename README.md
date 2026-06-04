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
cd backend
pip install -r requirements.txt
copy .env.example .env          # Windows
python -m app.utils.seed        # Charge 38 bâtiments + flux récents
uvicorn app.main:app --reload --port 8000
```

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

> Pas de préfixe `/api` côté backend. Le frontend utilise `/api` via proxy Vite.

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

## Mode hors ligne

Si le backend est indisponible, le frontend charge automatiquement :
- `frontend/src/data/campus.json`
- `frontend/src/data/capteurs.json`
- `frontend/src/data/frequentation.csv`

Un badge **« Mode hors ligne »** s'affiche.

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
