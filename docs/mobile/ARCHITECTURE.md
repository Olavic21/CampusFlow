# Architecture — CampusFlow

## Vue d'ensemble

```
CampusFlow
├── Student App (mobile-first)
│   ├── Accueil (état campus + accès rapides)
│   ├── Carte (occupation + incidents + position)
│   ├── Recherche (texte, catégories, libre maintenant)
│   ├── Itinéraires (profils, alternatives, favoris)
│   ├── Navigation (guide + GPS)
│   └── Mes lieux (favoris, historique, alertes)
├── Campus Intelligence (backend)
│   ├── Ingestion capteurs (simulation|MQTT|API, normalisée)
│   ├── Occupation & Crowd Levels (source canonique)
│   ├── Routage (graphe unique, profils, incidents)
│   ├── Prévisions (profil horaire, SANS ML)
│   └── Rétention & agrégats
└── Admin Console (RBAC staff/admin)
    ├── Dashboard (santé campus, capteurs offline)
    ├── Capteurs (CRUD, heartbeat, test-inject sécurisé)
    ├── Incidents (créer/fermer zone)
    ├── Données (rétention, exports)
    └── Utilisateurs
```

## Stack

| Couche | Technologie |
| :--- | :--- |
| Frontend | React 19 + Vite 8 + Tailwind 3 + Framer Motion |
| Carte | Leaflet 1.9 + react-leaflet 5 |
| Itinéraires | Dijkstra heapq (backend unique) |
| Temps réel | WebSocket + polling fallback |
| Offline | localforage + campus.json embarqué |
| Mobile | Capacitor 8 (Android) |
| Backend | FastAPI 0.111 + Pydantic 2 |
| BDD | SQLite (dev) / PostgreSQL (prod) |
| Cache | Redis (fallback gracieux) |
| Auth | JWT HS256 (access 60min / refresh 30j) |
| RBAC | Middleware FastAPI + claims JWT |
| IoT | Providers pluggables (simulation/api/mqtt/websocket/hybrid) |
| MQTT | paho-mqtt v1 (dans requirements) |
| Rétention | Background task asyncio (90j) |
| Tests | vitest (17) + pytest (55) |

## Qualité des données

| Source | Badge | Signification |
| :--- | :--- | :--- |
| REAL | 🟢 | Capteur physique (MQTT/HTTP) |
| SIMULATED | 🟡 | Moteur simulation backend |
| TWIN | ⚪ | Jumeau numérique (démo, non utilisé dans stats) |
| PREDICTED | 🔮 | Prévision (profil horaire 24h) |
| CACHED | ⏱ | Cache Redis (obsolète possible) |
| STALE | ⚠️ | Pas de données récentes (> 2× intervalle) |

## RBAC

| Rôle | Permissions |
| :--- | :--- |
| student (défaut) | Lecture, favoris, itinéraires, liste capteurs |
| staff | + CRUD incidents, capteurs, heartbeat, test-data |
| admin | + CRUD utilisateurs, suppression capteurs, clear-test-data, /admin/* |

## Rétention

- Simulateur : ~76 lignes/10s, ~650k lignes/jour en SQLite
- Rétention : 90 jours (`RETENTION_DAYS`)
- Purge : au démarrage + toutes les 6h (background asyncio)
- Tables : sensor_readings, flux

## Tests

- Frontend : vitest — 17 tests (6 fichiers) ✅
- Backend : pytest — 55 tests (14 fichiers) ✅

---