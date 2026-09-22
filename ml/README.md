# ml/

Modèle de prédiction de congestion des salles du campus SUP'PTIC.

## Contenu

- `congestion.ipynb` — notebook d'entraînement complet
- `model.pkl` — modèle sérialisé (Random Forest + metadata)
- `locust.py` — scénario de tests de charge Locust pour l'API CampusFlow

## Ce que le modèle prédit

Niveau de congestion d'une salle : `faible / moyen / élevé`

Le modèle prédit l'écart entre le planning officiel et la présence réelle
des étudiants — pas l'emploi du temps.

## Features attendues

| Feature | Type | Description |
|---|---|---|
| location_id | int | ID du bâtiment |
| heure_du_jour | int | 0-23 |
| jour_semaine | int | 0=Lundi, 5=Samedi |
| activite_prevue | int | 1 si cours planifié, 0 sinon |
| flux_moyen_historique | float | Moyenne glissante sur 4 obs. par salle |
| capacite | int | Capacité max (mergée depuis campus.json) |

## Performances

| Classe | Precision | Recall | F1 |
|---|---|---|---|
| faible | 0.81 | 0.82 | 0.81 |
| moyen | 0.55 | 0.59 | 0.57 |
| élevé | 0.77 | 0.65 | 0.71 |

Accuracy globale : 0.71

## Utilisation

```python
import joblib
import pandas as pd

loaded = joblib.load('ml/model.pkl')
model = loaded['model']

sample = pd.DataFrame([{
    'location_id': 1,
    'heure_du_jour': 8,
    'jour_semaine': 0,
    'activite_prevue': 1,
    'flux_moyen_historique': 80.0,
    'capacite': 120
}])

prediction = model.predict(sample)[0]
label = loaded['label_reverse'][prediction]
print(label)  # faible / moyen / eleve
```

## Tests de charge (Locust)

`locust.py` simule des utilisateurs qui sollicitent les endpoints de l'API :

| Endpoint | Méthode | Poids | Description |
|---|---|---|---|
| `/locations` | GET | 3 | Liste des bâtiments |
| `/flux/live` | GET | 3 | Flux en temps réel |
| `/congestion` | GET | 2 | Congestion actuelle |
| `/path?from=&to=` | GET | 1 | Itinéraire entre deux salles |
| `/predict` | POST | 4 | Prédiction ML (endpoint prioritaire) |

Lancer l'API puis, depuis `ml/` :

```bash
pip install locust
locust -f locust.py --host=http://localhost:8000
```

Interface web : http://localhost:8089 — définir le nombre d'utilisateurs et le taux de montée en charge.

## Dépendances

```
scikit-learn
pandas
numpy
joblib
matplotlib
seaborn
locust
```