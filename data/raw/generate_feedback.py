
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Charger les données de flux pour obtenir une plage de temps cohérente
try:
    flux_df = pd.read_csv("flux historique.csv")
    start_date_flux = pd.to_datetime(flux_df["timestamp"]).min()
    end_date_flux = pd.to_datetime(flux_df["timestamp"]).max()
except FileNotFoundError:
    print("flux historique.csv non trouvé. Veuillez le générer d'abord.")
    exit()

# Phrases de feedback en français
positive_feedbacks = [
    "Super cours aujourd'hui à l'Amphi, très intéressant !",
    "La bibliothèque est un endroit parfait pour étudier, très calme et bien équipée.",
    "J'ai adoré la séance de TP en L24, le prof était top.",
    "Bonne ambiance en C17, les discussions étaient enrichissantes.",
    "Le campus est vraiment agréable, j'aime y passer mes journées.",
    "Les équipements du laboratoire L27 sont à la pointe, c'est un plaisir de travailler ici.",
    "Très productif en C5 aujourd'hui, petit groupe mais efficace.",
    "J'apprécie la propreté des lieux et la disponibilité des ressources.",
    "Excellente journée d'étude, tout est bien organisé.",
    "Le personnel est toujours prêt à aider, c'est très appréciable."
]

negative_feedbacks = [
    "Trop de monde à la bibliothèque, difficile de trouver une place.",
    "Le cours en Amphi était un peu ennuyeux aujourd'hui.",
    "Problème de connexion internet en C16, c'est frustrant.",
    "Les chaises en L23 sont inconfortables, difficile de se concentrer.",
    "Manque de prises électriques en C6, c'est un problème pour les laptops.",
    "Le laboratoire L20 est un peu vétuste, il faudrait le moderniser.",
    "Trop de bruit dans les couloirs près de L29, ça dérange.",
    "J'ai eu froid en C12, la climatisation était trop forte.",
    "Le distributeur de café en panne, c'est dommage.",
    "Les informations sur les emplois du temps ne sont pas toujours claires."
]

neutral_feedbacks = [
    "Journée normale sur le campus.",
    "Rien de spécial à signaler aujourd'hui.",
    "J'ai assisté à mon cours en C17.",
    "J'ai travaillé à la bibliothèque ce matin.",
    "Les installations sont fonctionnelles.",
    "J'ai passé un moment en L24.",
    "Le campus est calme aujourd'hui.",
    "J'ai révisé mes cours en C5.",
    "La journée s'est bien passée.",
    "J'ai utilisé le laboratoire L21."
]

all_feedbacks = []
num_feedbacks = 1000 # Nombre de feedbacks à générer
num_students = 200 # Assumer le même nombre d'étudiants que pour les schedules

for i in range(num_feedbacks):
    etudiant_id = random.randint(1, num_students)

    # Générer un timestamp aléatoire dans la plage des flux
    time_delta = end_date_flux - start_date_flux
    random_seconds = random.randint(0, int(time_delta.total_seconds()))
    timestamp = start_date_flux + timedelta(seconds=random_seconds)

    sentiment_choice = random.choices(["positif", "negatif", "neutre"], weights=[0.6, 0.2, 0.2], k=1)[0]

    if sentiment_choice == "positif":
        texte = random.choice(positive_feedbacks)
    elif sentiment_choice == "negatif":
        texte = random.choice(negative_feedbacks)
    else:
        texte = random.choice(neutral_feedbacks)

    all_feedbacks.append({
        "etudiant_id": etudiant_id,
        "texte": texte,
        "sentiment": sentiment_choice,
        "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S")
    })

feedbacks_df = pd.DataFrame(all_feedbacks)
feedbacks_df.index.name = "id"
feedbacks_df.reset_index(inplace=True)
feedbacks_df["id"] = feedbacks_df.index + 1 # Ajouter un ID auto-incrémenté

feedbacks_df.to_csv("feedbacks.csv", index=False, encoding="utf-8")
print("feedbacks.csv généré avec succès.")
