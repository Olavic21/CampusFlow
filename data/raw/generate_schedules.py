import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

with open("campus.json", "r", encoding="utf-8") as f:
    locations_data = json.load(f)
locations_df = pd.DataFrame(locations_data)

# ── Groupes ──────────────────────────────────────────────────
GROUPES_COURS = [
    "ITT1A", "ITT1B", "ITT2A", "ITT2B",
    "ITT3RC", "ITT3IR", "IPT1", "IPT2"
]

# TP uniquement pour les niveaux 1 et 2 ITT
GROUPES_AVEC_TP = ["ITT1A", "ITT1B", "ITT2A", "ITT2B"]
GROUPES_TP = [
    f"{gc}-G{g}" for gc in GROUPES_AVEC_TP for g in range(1, 5)
]
# ITT1A-G1, ITT1A-G2, ITT1A-G3, ITT1A-G4
# ITT2A-G1, ITT2A-G2, ITT2A-G3, ITT2A-G4
# soit 16 groupes de TP au total

# ── Créneaux horaires ────────────────────────────────────────
creneaux = [
    (7, 9), (9, 11), (11, 13),
    (13, 15), (15, 17), (17, 19)
]

# ── Salles par type ──────────────────────────────────────────
salles_amphi   = locations_df[locations_df['capacite'] >= 100]
salles_cours   = locations_df[
    (locations_df['capacite'] >= 30) &
    (locations_df['capacite'] < 100) &
    (locations_df['nom'] != 'Bibliothèque')
]
salles_tp      = locations_df[
    (locations_df['capacite'] <= 60) &
    (locations_df['nom'] != 'Bibliothèque')
]

# ── Génération ───────────────────────────────────────────────
start_date = datetime(2026, 5, 1)
num_weeks = 4
all_schedules = []
schedule_id = 1

for week in range(num_weeks):
    for day_offset in range(6):  # Lundi à Samedi
        current_date = start_date + timedelta(weeks=week, days=day_offset)
        jour_semaine = current_date.weekday()

        # ── Cours magistraux (groupes de cours) ──
        for groupe in GROUPES_COURS:
            # 1 à 3 créneaux par jour par groupe
            num_activites = np.random.randint(1, 4)
            creneaux_choisis = np.random.choice(
                len(creneaux), size=num_activites, replace=False
            )

            for idx in creneaux_choisis:
                debut_h, fin_h = creneaux[idx]

                # Cours magistral → amphi ou grande salle de cours
                # 60% amphi, 40% salle de cours
                if np.random.rand() < 0.60 and len(salles_amphi) > 0:
                    salle = salles_amphi.sample(1).iloc[0]
                else:
                    salle = salles_cours.sample(1).iloc[0]

                all_schedules.append({
                    "id": schedule_id,
                    "groupe": groupe,
                    "type_activite": "cours",
                    "salle_id": int(salle["id"]),
                    "heure_debut": current_date.replace(hour=debut_h, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S"),
                    "heure_fin": current_date.replace(hour=fin_h, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S"),
                    "jour_semaine": jour_semaine
                })
                schedule_id += 1

        # ── Travaux pratiques (groupes TP) ──
        for groupe_tp in GROUPES_TP:
            # Les TP ont lieu 1 à 2 fois par jour max
            num_activites = np.random.randint(0, 3)
            if num_activites == 0:
                continue

            creneaux_choisis = np.random.choice(
                len(creneaux), size=num_activites, replace=False
            )

            for idx in creneaux_choisis:
                debut_h, fin_h = creneaux[idx]

                # TP → majoritairement salles TP (80%), parfois salle de cours (20%)
                if np.random.rand() < 0.80:
                    salle = salles_tp.sample(1).iloc[0]
                else:
                    salle = salles_cours.sample(1).iloc[0]

                all_schedules.append({
                    "id": schedule_id,
                    "groupe": groupe_tp,
                    "type_activite": "tp",
                    "salle_id": int(salle["id"]),
                    "heure_debut": current_date.replace(hour=debut_h, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S"),
                    "heure_fin": current_date.replace(hour=fin_h, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S"),
                    "jour_semaine": jour_semaine
                })
                schedule_id += 1

schedules_df = pd.DataFrame(all_schedules)
schedules_df.to_csv("schedules.csv", index=False, encoding="utf-8")
print(f"schedules.csv généré — {len(schedules_df)} lignes")
print(schedules_df.head(15))