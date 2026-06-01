# CampusFlow

Projet monorepo — chaque partie a son dossier à la racine :

```
CampusFlow/
├── frontend/     # Application React (Vite) — interface mobile
├── backend/      # API FastAPI — logique métier
├── data/         # Données, scripts Python, schéma PostgreSQL
└── ml/           # Modèles Machine Learning
```

## Démarrage rapide

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Données
```bash
cd data/raw
python generate_flux.py
python generate_schedules.py
# Voir data/README.md pour le détail
```
