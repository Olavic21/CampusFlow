"""Generate SUP'PTIC campus data: campus.json (38), capteurs.json, frequentation.csv, flux historique.csv"""
import json
import csv
import random
from datetime import datetime, timedelta

random.seed(42)

# 38 bâtiments — SUP'PTIC Yaoundé (Melen, ~3.8691°N 11.5083°E)
BUILDINGS = [
    {"id": 1, "nom": "Direction Générale", "latitude": 3.87025, "longitude": 11.5085, "capacite": 30, "type": "admin"},
    {"id": 2, "nom": "Secrétariat Pédagogique", "latitude": 3.87010, "longitude": 11.5083, "capacite": 25, "type": "admin"},
    {"id": 3, "nom": "Comptabilité", "latitude": 3.87015, "longitude": 11.5087, "capacite": 20, "type": "admin"},
    {"id": 4, "nom": "Infirmerie", "latitude": 3.86995, "longitude": 11.5078, "capacite": 10, "type": "admin"},
    {"id": 5, "nom": "Amphi 100", "latitude": 3.86965, "longitude": 11.5088, "capacite": 120, "type": "amphi"},
    {"id": 6, "nom": "Amphi 200", "latitude": 3.86980, "longitude": 11.5085, "capacite": 200, "type": "amphi"},
    {"id": 7, "nom": "Amphi 300", "latitude": 3.86955, "longitude": 11.5090, "capacite": 150, "type": "amphi"},
    {"id": 8, "nom": "Labo Réseaux & Télécoms", "latitude": 3.86953, "longitude": 11.509222, "capacite": 20, "type": "labo"},
    {"id": 9, "nom": "Labo Informatique", "latitude": 3.86940, "longitude": 11.5091, "capacite": 25, "type": "labo"},
    {"id": 10, "nom": "Labo Électronique", "latitude": 3.86935, "longitude": 11.5089, "capacite": 20, "type": "labo"},
    {"id": 11, "nom": "Labo Télécoms", "latitude": 3.86948, "longitude": 11.5094, "capacite": 18, "type": "labo"},
    {"id": 12, "nom": "Labo Optique", "latitude": 3.86930, "longitude": 11.5093, "capacite": 15, "type": "labo"},
    {"id": 13, "nom": "Labo Systèmes Embarqués", "latitude": 3.86925, "longitude": 11.5090, "capacite": 20, "type": "labo"},
    {"id": 14, "nom": "C-1", "latitude": 3.87000, "longitude": 11.5075, "capacite": 50, "type": "salle"},
    {"id": 15, "nom": "C-2", "latitude": 3.86990, "longitude": 11.5076, "capacite": 50, "type": "salle"},
    {"id": 16, "nom": "C-3", "latitude": 3.86980, "longitude": 11.5075, "capacite": 45, "type": "salle"},
    {"id": 17, "nom": "C-4", "latitude": 3.86970, "longitude": 11.5074, "capacite": 45, "type": "salle"},
    {"id": 18, "nom": "C-5", "latitude": 3.86960, "longitude": 11.5073, "capacite": 40, "type": "salle"},
    {"id": 19, "nom": "C-6", "latitude": 3.86962, "longitude": 11.507416, "capacite": 50, "type": "salle"},
    {"id": 20, "nom": "C-7", "latitude": 3.86950, "longitude": 11.5072, "capacite": 40, "type": "salle"},
    {"id": 21, "nom": "C-8", "latitude": 3.86940, "longitude": 11.5071, "capacite": 35, "type": "salle"},
    {"id": 22, "nom": "C-9", "latitude": 3.86930, "longitude": 11.5070, "capacite": 35, "type": "salle"},
    {"id": 23, "nom": "C-10", "latitude": 3.86920, "longitude": 11.507055, "capacite": 30, "type": "salle"},
    {"id": 24, "nom": "L-10", "latitude": 3.86890, "longitude": 11.5075, "capacite": 40, "type": "salle"},
    {"id": 25, "nom": "L-11", "latitude": 3.86880, "longitude": 11.5077, "capacite": 40, "type": "salle"},
    {"id": 26, "nom": "L-12", "latitude": 3.86870, "longitude": 11.5079, "capacite": 35, "type": "salle"},
    {"id": 27, "nom": "L-13", "latitude": 3.86865, "longitude": 11.5080, "capacite": 35, "type": "salle"},
    {"id": 28, "nom": "L-18", "latitude": 3.868539, "longitude": 11.508139, "capacite": 40, "type": "salle"},
    {"id": 29, "nom": "L-19", "latitude": 3.86860, "longitude": 11.5083, "capacite": 30, "type": "salle"},
    {"id": 30, "nom": "L-20", "latitude": 3.86875, "longitude": 11.5085, "capacite": 30, "type": "salle"},
    {"id": 31, "nom": "L-21", "latitude": 3.86885, "longitude": 11.5087, "capacite": 25, "type": "salle"},
    {"id": 32, "nom": "L-22", "latitude": 3.86900, "longitude": 11.5089, "capacite": 25, "type": "salle"},
    {"id": 33, "nom": "L-23", "latitude": 3.86910, "longitude": 11.5092, "capacite": 20, "type": "salle"},
    {"id": 34, "nom": "L-24", "latitude": 3.86905, "longitude": 11.5095, "capacite": 20, "type": "salle"},
    {"id": 35, "nom": "Bibliothèque", "latitude": 3.87030, "longitude": 11.5090, "capacite": 80, "type": "salle"},
    {"id": 36, "nom": "Salle TP C-11", "latitude": 3.86975, "longitude": 11.5096, "capacite": 15, "type": "labo"},
    {"id": 37, "nom": "Salle TP C-12", "latitude": 3.86985, "longitude": 11.5097, "capacite": 15, "type": "labo"},
    {"id": 38, "nom": "Auditorium", "latitude": 3.870386, "longitude": 11.5088, "capacite": 100, "type": "amphi"},
]

REF_DATE = datetime(2024, 10, 7)


def occupancy_for(building, hour, minute=0, day_offset=0):
    cap = building["capacite"]
    nom = building["nom"]
    t = building["type"]
    base = 0.1

    if t == "amphi":
        base = 0.5 if 8 <= hour <= 11 else 0.2
    elif t == "labo":
        base = 0.55 if 9 <= hour <= 12 or 14 <= hour <= 17 else 0.15
    elif t == "admin":
        base = 0.3 if 8 <= hour <= 17 else 0.05
    elif "Bibliothèque" in nom:
        base = 0.6 if 12 <= hour < 14 or hour >= 17 else 0.25
    else:
        base = 0.45 if 9 <= hour <= 11 or 14 <= hour <= 16 else 0.15

    if nom == "Labo Réseaux & Télécoms" and hour == 9:
        base = 0.85
    if nom == "Infirmerie":
        base = 0.0 if hour < 8 else 0.05

    noise = random.uniform(-0.08, 0.08)
    taux = max(0, min(1.05, base + noise))
    return max(0, min(cap, int(taux * cap)))


def niveau_congestion(n, capacite):
    taux = n / capacite if capacite else 0
    if taux < 0.30:
        return "faible"
    if taux <= 0.70:
        return "moyen"
    return "eleve"


def activite_prevue(building, hour, jour):
    if jour == 5 and hour > 13:
        return 0
    if building["type"] == "admin":
        return 1 if 8 <= hour <= 17 else 0
    if building["type"] == "amphi":
        return 1 if jour in (0, 2, 4) and 8 <= hour <= 12 else 0
    return 1 if 8 <= hour <= 18 and random.random() > 0.3 else 0


capteurs = []
for b in BUILDINGS:
    for h in range(24):
        for m in (0, 30):
            capteurs.append({
                "location_id": b["id"],
                "timestamp": REF_DATE.replace(hour=h, minute=m, second=0).strftime("%Y-%m-%dT%H:%M:%S"),
                "heure": h,
                "minute": m,
                "nombre_etudiants": occupancy_for(b, h, m),
            })

frequentation = []
start = datetime(2024, 9, 9)
for week in range(4):
    for day in range(6):
        current = start + timedelta(weeks=week, days=day)
        for hour in range(7, 19):
            for b in BUILDINGS:
                frequentation.append({
                    "location_id": b["id"],
                    "timestamp": current.replace(hour=hour, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S"),
                    "heure_du_jour": hour,
                    "jour_semaine": current.weekday(),
                    "nombre_etudiants": occupancy_for(b, hour, 0, week * 6 + day),
                })

flux_historique = []
flux_start = datetime(2024, 9, 9)
for week in range(4):
    for day in range(6):
        current = flux_start + timedelta(weeks=week, days=day)
        jour = current.weekday()
        for hour in range(7, 22):
            for b in BUILDINGS:
                n = occupancy_for(b, hour, 0, week * 6 + day)
                flux_historique.append({
                    "location_id": b["id"],
                    "timestamp": current.replace(hour=hour, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S"),
                    "heure_du_jour": hour,
                    "jour_semaine": jour,
                    "activite_prevue": activite_prevue(b, hour, jour),
                    "nombre_etudiants": n,
                    "niveau_congestion": niveau_congestion(n, b["capacite"]),
                })

out_dir = "."
with open(f"{out_dir}/campus.json", "w", encoding="utf-8") as f:
    json.dump(BUILDINGS, f, ensure_ascii=False, indent=2)
with open(f"{out_dir}/capteurs.json", "w", encoding="utf-8") as f:
    json.dump(capteurs, f, ensure_ascii=False, indent=2)
with open(f"{out_dir}/frequentation.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["location_id", "timestamp", "heure_du_jour", "jour_semaine", "nombre_etudiants"])
    w.writeheader()
    w.writerows(frequentation)
with open(f"{out_dir}/flux historique.csv", "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=[
        "location_id", "timestamp", "heure_du_jour", "jour_semaine",
        "activite_prevue", "nombre_etudiants", "niveau_congestion",
    ])
    w.writeheader()
    w.writerows(flux_historique)

print(f"campus.json: {len(BUILDINGS)} bâtiments SUP'PTIC")
print(f"capteurs.json: {len(capteurs)} snapshots")
print(f"frequentation.csv: {len(frequentation)} lignes")
print(f"flux historique.csv: {len(flux_historique)} lignes")
