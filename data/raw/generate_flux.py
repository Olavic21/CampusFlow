
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

# Charger les données des lieux depuis campus.json
with open('campus.json', 'r', encoding='utf-8') as f:
    locations_data = json.load(f)

locations_df = pd.DataFrame(locations_data)

# Paramètres de génération
start_date = datetime(2026, 5, 1)
num_weeks = 4
days_of_week = range(0, 6)  # Lundi (0) à Samedi (5)
hours_of_day = range(7, 22) # 7h à 21h (exclusif pour 22h)

data = []

for week in range(num_weeks):
    for day_offset in days_of_week:
        current_date = start_date + timedelta(weeks=week, days=day_offset)
        if current_date.weekday() == 6: # Skip Sunday
            continue

        for hour in hours_of_day:
            for _, location in locations_df.iterrows():
                location_id = location['id']
                capacite = location['capacite']
                nom_lieu = location['nom']

                timestamp = current_date.replace(hour=hour, minute=0, second=0)
                jour_semaine = current_date.weekday() # 0=Lundi, 5=Samedi
                heure_du_jour = hour

                activite_prevue = 0
                nombre_etudiants = 0

                # Règles de réalisme
                if nom_lieu == "Bibliothèque":
                    activite_prevue = 0
                    if 12 <= heure_du_jour < 14 or heure_du_jour >= 17:
                        nombre_etudiants = int(np.random.uniform(0.25, 0.70) * capacite) # Peaks
                    else:
                        nombre_etudiants = int(np.random.uniform(0.00, 0.25) * capacite)
                elif nom_lieu == "Amphi":
                    if jour_semaine in [0, 2, 4]: # Lundi, Mercredi, Vendredi
                        activite_prevue = 1
                elif capacite == 15: # Petites salles de TP (C5, C6, C13, L26, L28)
                    if jour_semaine in [1, 3]: # Mardi, Jeudi
                        activite_prevue = 1
                else:
                    # Activité par défaut pour les autres salles
                    if np.random.rand() > 0.75: # 75% chance d'activité prévue
                        activite_prevue = 1

                # Quand activite_prevue=1, rester dans la zone moyen-élevé
                if activite_prevue == 1:
                    nombre_etudiants = int(np.random.uniform(0.45, 0.80) * capacite)

                # Quand pas d'activité prévue — majoritairement vide
                elif activite_prevue == 0 and nom_lieu != "Bibliothèque":
                    nombre_etudiants = int(np.random.uniform(0.00, 0.25) * capacite)  # était 0.00-0.55

                # Quand activité prévue — rester sous 70%
                if activite_prevue == 1:
                    nombre_etudiants = int(np.random.uniform(0.35, 0.65) * capacite)  # était 0.45-0.80

                # Amphi spécifiquement
                if nom_lieu == "Amphi" and activite_prevue == 1:
                    nombre_etudiants = int(np.random.uniform(0.30, 0.65) * capacite)

                # Bibliothèque — réduire aussi les pics
                if 12 <= heure_du_jour < 14 or heure_du_jour >= 17:
                    nombre_etudiants = int(np.random.uniform(0.15, 0.55) * capacite)  # était 0.25-0.70
                else:
                    nombre_etudiants = int(np.random.uniform(0.00, 0.15) * capacite)  # était 0.00-0.25

                # Réduction samedi plus agressive
                if jour_semaine == 5:
                    nombre_etudiants = int(nombre_etudiants * np.random.uniform(0.20, 0.50))  # était 0.50-0.80
                # Ajouter du bruit aléatoire
                nombre_etudiants = max(0, min(capacite, nombre_etudiants + np.random.randint(-5, 2)))

                # Calcul niveau_congestion
                taux_occupation = nombre_etudiants / capacite
                if taux_occupation < 0.30:
                    niveau_congestion = "faible"
                elif 0.30 <= taux_occupation <= 0.70:
                    niveau_congestion = "moyen"
                else:
                    niveau_congestion = "eleve"

                data.append({
                    "location_id": location_id,
                    "timestamp": timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    "heure_du_jour": heure_du_jour,
                    "jour_semaine": jour_semaine,
                    "activite_prevue": activite_prevue,
                    "nombre_etudiants": nombre_etudiants,
                    "niveau_congestion": niveau_congestion
                })

df = pd.DataFrame(data)

# Assurer un minimum de 5000 lignes (le calcul actuel devrait en générer beaucoup plus)
# 4 semaines * 6 jours/semaine * 15 heures/jour * 17 lieux = 6120 lignes

df.to_csv('flux historique.csv', index=False, encoding='utf-8')
print("flux historique.csv généré avec succès.")
