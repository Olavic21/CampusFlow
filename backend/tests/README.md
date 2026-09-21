# CampusFlow — Suite de tests backend (document officiel)

> Dernière mise à jour : 2026-09-21 — suite reconstruite après audit.
> **Résultat : 14 fichiers, 55 tests, 0 échec.**

## 1. Prérequis

| Paquet | Rôle |
| :--- | :--- |
| fakeredis | Redis mock (aucun serveur Redis requis) |
| httpx==0.27.2 | Client HTTP asynchrone pour TestClient |
| pytest==9.0.3 | Framework de test |

Installation unique :

```bash
cd backend
pip install -r requirements-dev.txt
```

## 2. Lancement

```bash
# Depuis la racine du monorepo :
python -m pytest backend/tests/ -v

# Ou depuis backend/ :
cd backend
pytest tests/ -v
```

**Résultat attendu : 14 passed, 55 tests.**

## 3. Fichiers de test

| Fichier | Domaine | Tests |
| :--- | :--- | :--- |
| conftest.py | Fixtures | — |
| test_admin.py | Admin RBAC | 9 |
| test_congestion.py | Congestion | 6 |
| test_data_quality.py | Qualité données | 5 |
| test_dashboard.py | Dashboard | 4 |
| test_flux.py | Flux | 5 |
| test_incidents.py | Incidents | 9 |
| test_intelligence.py | Prévisions 24h | 5 |
| test_locations.py | Lieux + routing | 3 |
| test_path.py | Routage | 3 |
| test_predict.py | ML (optionnel) | 3 |
| test_rbac.py | Rôles + permissions | 5 |
| test_sensor_crud.py | CRUD capteurs | 6 |
| test_sensors.py | Supervision IoT | 8 |
| test_services.py | Services isolés | 3 |

## 4. Bonnes pratiques

- Validation Pydantic (schemas/)
- Erreurs centralisées (utils/errors.py)
- Cache Redis sur la congestion
- Logique dans services/, routes fines dans routers/
- Config via .env, pas de secrets en dur

## 5. Dépannage

| Problème | Solution |
| :--- | :--- |
| ImportError fakeredis/httpx | `pip install -r requirements-dev.txt` |
| No module named 'app' | `cd backend` puis relancer |
| 503 sur /predict | Vérifier ML_MODEL_PATH |

---

*CampusFlow — SUP'PTIC Yaoundé, Cameroun.*
