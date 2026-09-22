from pathlib import Path
import pandas as pd
import json
import sys
import os

# Configuration de l'environnement pour forcer l'anglais et l'UTF-8
# On ajoute plusieurs variantes car Windows peut être capricieux
os.environ["LC_ALL"] = "C"
os.environ["LANG"] = "C"
os.environ["PGMESSAGES"] = "C"
os.environ["PGCLIENTENCODING"] = "utf8"

import psycopg2

# Ensure data module is importable
# On remonte d'un niveau pour trouver le dossier 'data' qui contient io_utils.py
data_dir = Path(__file__).resolve().parent.parent
if str(data_dir) not in sys.path:
    sys.path.insert(0, str(data_dir))

from io_utils import read_csv_with_encodings

# Configuration de la base de données (à adapter si nécessaire)
DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "port": os.getenv("PGPORT", "5432"),
    "database": os.getenv("PGDATABASE", "campusflow"),
    "user": os.getenv("PGUSER", "campusflow"),
    "password": os.getenv("PGPASSWORD", "campusflow"),
}

DATA_DIR = Path(__file__).resolve().parent

def load_locations(cursor, conn):
    print("Chargement des données de locations...")
    with (DATA_DIR / "campus.json").open("r", encoding="utf-8") as f:
        locations_data = json.load(f)

    insert_query = """
    INSERT INTO locations (id, nom, latitude, longitude, capacite, type, geom)
    VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
    ON CONFLICT (id) DO UPDATE SET
        nom = EXCLUDED.nom,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        capacite = EXCLUDED.capacite,
        type = EXCLUDED.type,
        geom = EXCLUDED.geom;
    """
    
    values = [
        (loc["id"], loc["nom"], loc["latitude"], loc["longitude"], 
         loc["capacite"], loc["type"], loc["longitude"], loc["latitude"])
        for loc in locations_data
    ]

    cursor.executemany(insert_query, values)
    conn.commit()
    print(f"{len(locations_data)} locations chargées.")

def load_flux(cursor, conn):
    print("Chargement des données de flux...")
    flux_df = read_csv_with_encodings(DATA_DIR / "flux historique.csv")
    flux_df["timestamp"] = pd.to_datetime(flux_df["timestamp"])

    insert_query = """
    INSERT INTO flux (location_id, timestamp, nombre_etudiants, activite_prevue, heure_du_jour, jour_semaine, niveau_congestion)
    VALUES (%s, %s, %s, %s, %s, %s, %s);
    """
    
    values = [
        (row.location_id, row.timestamp, row.nombre_etudiants, 
         row.activite_prevue, row.heure_du_jour, row.jour_semaine, 
         row.niveau_congestion) 
        for row in flux_df.itertuples(index=False)
    ]

    cursor.executemany(insert_query, values)
    conn.commit()
    print(f"{len(flux_df)} enregistrements de flux chargés.")

def load_schedules(cursor, conn):
    print("Chargement des données de schedules...")
    schedules_df = read_csv_with_encodings(DATA_DIR / "schedule.csv")
    schedules_df["heure_debut"] = pd.to_datetime(schedules_df["heure_debut"])
    schedules_df["heure_fin"] = pd.to_datetime(schedules_df["heure_fin"])

    insert_query = """
    INSERT INTO schedules (id, etudiant_id, salle_id, heure_debut, heure_fin)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET
        etudiant_id = EXCLUDED.etudiant_id,
        salle_id = EXCLUDED.salle_id,
        heure_debut = EXCLUDED.heure_debut,
        heure_fin = EXCLUDED.heure_fin;
    """
    
    values = [
        (row.id, row.etudiant_id, row.salle_id, row.heure_debut, row.heure_fin)
        for row in schedules_df.itertuples(index=False)
    ]

    cursor.executemany(insert_query, values)
    conn.commit()
    print(f"{len(schedules_df)} enregistrements de schedules chargés.")

def load_feedbacks(cursor, conn):
    print("Chargement des données de feedbacks...")
    feedbacks_df = read_csv_with_encodings(DATA_DIR / "feedbacks.csv")
    feedbacks_df["timestamp"] = pd.to_datetime(feedbacks_df["timestamp"])

    insert_query = """
    INSERT INTO feedbacks (id, etudiant_id, texte, sentiment, timestamp)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET
        etudiant_id = EXCLUDED.etudiant_id,
        texte = EXCLUDED.texte,
        sentiment = EXCLUDED.sentiment,
        timestamp = EXCLUDED.timestamp;
    """
    
    values = [
        (row.id, row.etudiant_id, row.texte, row.sentiment, row.timestamp)
        for row in feedbacks_df.itertuples(index=False)
    ]

    cursor.executemany(insert_query, values)
    conn.commit()
    print(f"{len(feedbacks_df)} enregistrements de feedbacks chargés.")

def main():
    conn = None
    try:
        print(f"[DEBUG] Connexion à PostgreSQL (host={DB_CONFIG['host']}, db={DB_CONFIG['database']})...")
        conn = psycopg2.connect(**DB_CONFIG)
        print("[DEBUG] Connection established")
        cursor = conn.cursor()

        print("[DEBUG] Loading locations...")
        load_locations(cursor, conn)
        print("[DEBUG] ✓ Locations loaded")
        
        print("[DEBUG] Loading flux...")
        load_flux(cursor, conn)
        print("[DEBUG] ✓ Flux loaded")
        
        print("[DEBUG] Loading schedules...")
        load_schedules(cursor, conn)
        print("[DEBUG] ✓ Schedules loaded")
        
        print("[DEBUG] Loading feedbacks...")
        load_feedbacks(cursor, conn)
        print("[DEBUG] ✓ Feedbacks loaded")

    except psycopg2.OperationalError as e:
        print("\n--- ERREUR DE CONNEXION ---")
        print("La connexion à la base de données a été refusée.")
        print("Vérifiez que :")
        print(f" 1. La base de données '{DB_CONFIG['database']}' existe.")
        print(f" 2. L'utilisateur '{DB_CONFIG['user']}' existe avec le bon mot de passe.")
        print("---------------------------\n")
    except Exception as e:
        # On force la conversion en string sécurisée pour éviter le crash Unicode lors du print
        try:
            print(f"Erreur lors du chargement des données : {e}")
        except UnicodeEncodeError:
            print(f"Erreur lors du chargement des données : {str(e).encode('ascii', 'replace').decode('ascii')}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            cursor.close()
            conn.close()
            print("Connexion à la base de données fermée.")

if __name__ == "__main__":
    main()
