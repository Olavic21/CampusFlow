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

> Pas de préfixe `/api` côté backend. Le frontend utilise `/api` via proxy Vite.

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
