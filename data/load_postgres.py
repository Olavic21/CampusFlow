import json
import os
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import connection as _connection
from io_utils import read_csv_with_encodings

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw"
SCHEMA_FILE = BASE_DIR / "db" / "schema.sql"

DB_CONFIG = {
    "host": os.getenv("PGHOST", "localhost"),
    "port": int(os.getenv("PGPORT", 5432)),
    "database": os.getenv("PGDATABASE", "campusflow"),
    "user": os.getenv("PGUSER", "campusflow"),
    "password": os.getenv("PGPASSWORD", "campusflow"),
}


def connect() -> _connection:
    """Établit une connexion à la base de données PostgreSQL."""
    # Sur Windows, les messages d'erreur localisés (ex: en français) provoquent une UnicodeDecodeError.
    # Forcer LC_ALL à 'C' permet d'obtenir les erreurs en anglais/ASCII.
    os.environ["LC_ALL"] = "C"
    os.environ["PGCLIENTENCODING"] = "utf8"
    
    try:
        return psycopg2.connect(**DB_CONFIG)
    except psycopg2.Error as e:
        print("\n--- Connection Error ---")
        print(f"Detail: {e}")
        print("Please check if PostgreSQL is running and your credentials in DB_CONFIG are correct.")
        print("------------------------\n")
        raise

def file_path(name: str) -> Path:
    path = RAW_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Fichier de données introuvable : {path}")
    return path


def run_sql_file(conn: _connection, schema_path: Path) -> None:
    with schema_path.open("r", encoding="utf-8") as f:
        sql_text = f.read()

    with conn.cursor() as cursor:
        cursor.execute(sql_text)
    conn.commit()


def has_column(conn: _connection, table: str, column: str) -> bool:
    query = """
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = %s
      AND column_name = %s
    """
    with conn.cursor() as cursor:
        cursor.execute(query, (table, column))
        return cursor.fetchone() is not None


def create_fallback_schema(conn: _connection) -> None:
    fallback_sql = """
    CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        latitude NUMERIC(9, 6) NOT NULL,
        longitude NUMERIC(9, 6) NOT NULL,
        capacite INTEGER NOT NULL,
        type VARCHAR(100) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        etudiant_id INTEGER NOT NULL,
        salle_id INTEGER NOT NULL,
        heure_debut TIMESTAMP WITH TIME ZONE NOT NULL,
        heure_fin TIMESTAMP WITH TIME ZONE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flux (
        id SERIAL PRIMARY KEY,
        location_id INTEGER NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        nombre_etudiants INTEGER NOT NULL,
        activite_prevue INTEGER NOT NULL,
        heure_du_jour INTEGER NOT NULL,
        jour_semaine INTEGER NOT NULL,
        niveau_congestion VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
        id SERIAL PRIMARY KEY,
        etudiant_id INTEGER NOT NULL,
        texte TEXT NOT NULL,
        sentiment VARCHAR(50) NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL
    );
    """
    with conn.cursor() as cursor:
        cursor.execute(fallback_sql)
    conn.commit()


def ensure_schema(conn: _connection) -> None:
    if not SCHEMA_FILE.exists():
        raise FileNotFoundError(f"Schema file missing: {SCHEMA_FILE}")

    try:
        run_sql_file(conn, SCHEMA_FILE)
        print(f"Schema created/updated from {SCHEMA_FILE}")
    except Exception as exc:
        print(f"Warning: Impossible de créer le schéma depuis {SCHEMA_FILE}.")
        if "privilege" in str(exc).lower() or "droit" in str(exc).lower():
            print("\n!!! ERREUR DE PRIVILÈGES : L'utilisateur n'a pas le droit de créer des tables dans le schéma 'public'.")
            print("Solution: psql -U postgres -d campusflow -c \"GRANT ALL ON SCHEMA public TO campusflow;\"\n")
        print("Tentative de fallback vers un schéma PostgreSQL simple...")
        conn.rollback()
        create_fallback_schema(conn)
        print("Fallback schema created.")


def load_locations(conn: _connection) -> None:
    path = file_path("campus.json")
    with path.open("r", encoding="utf-8") as f:
        locations = json.load(f)

    insert_geom = has_column(conn, "locations", "geom")
    if insert_geom:
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
    else:
        insert_query = """
        INSERT INTO locations (id, nom, latitude, longitude, capacite, type)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            nom = EXCLUDED.nom,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            capacite = EXCLUDED.capacite,
            type = EXCLUDED.type;
        """

    if insert_geom:
        values = [
            (
                loc["id"], loc["nom"], loc["latitude"], loc["longitude"],
                loc["capacite"], loc["type"], loc["longitude"], loc["latitude"]
            )
            for loc in locations
        ]
    else:
        values = [
            (
                loc["id"], loc["nom"], loc["latitude"], loc["longitude"],
                loc["capacite"], loc["type"]
            )
            for loc in locations
        ]

    with conn.cursor() as cursor:
        cursor.executemany(insert_query, values)
    conn.commit()
    print(f"{len(values)} locations chargées.")


def load_flux(conn: _connection) -> None:
    path = file_path("flux historique.csv")
    flux_df = read_csv_with_encodings(path)
    flux_df["timestamp"] = pd.to_datetime(flux_df["timestamp"])

    with conn.cursor() as cursor:
        cursor.execute("TRUNCATE TABLE flux RESTART IDENTITY CASCADE")
        insert_query = """
        INSERT INTO flux (location_id, timestamp, nombre_etudiants, activite_prevue, heure_du_jour, jour_semaine, niveau_congestion)
        VALUES (%s, %s, %s, %s, %s, %s, %s);
        """
        cursor.executemany(
            insert_query,
            [
                (
                    int(row.location_id),
                    row.timestamp.to_pydatetime(),
                    int(row.nombre_etudiants),
                    int(row.activite_prevue),
                    int(row.heure_du_jour),
                    int(row.jour_semaine),
                    str(row.niveau_congestion),
                )
                for row in flux_df.itertuples(index=False)
            ],
        )
    conn.commit()
    print(f"{len(flux_df)} enregistrements de flux chargés.")


def load_schedules(conn: _connection) -> None:
    path = file_path("schedules.csv")
    schedules_df = read_csv_with_encodings(path)
    schedules_df["heure_debut"] = pd.to_datetime(schedules_df["heure_debut"])
    schedules_df["heure_fin"] = pd.to_datetime(schedules_df["heure_fin"])

    insert_query = """
    INSERT INTO schedules (id, groupe, type_activite, salle_id, heure_debut, heure_fin, jour_semaine)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (id) DO UPDATE SET
        groupe = EXCLUDED.groupe,
        type_activite = EXCLUDED.type_activite,
        salle_id = EXCLUDED.salle_id,
        heure_debut = EXCLUDED.heure_debut,
        heure_fin = EXCLUDED.heure_fin,
        jour_semaine = EXCLUDED.jour_semaine;
    """

    values = [
        (
            int(row.id),
            str(row.groupe),
            str(row.type_activite),
            int(row.salle_id),
            row.heure_debut.to_pydatetime(),
            row.heure_fin.to_pydatetime(),
            int(row.jour_semaine),
        )
        for row in schedules_df.itertuples(index=False)
    ]

    with conn.cursor() as cursor:
        cursor.execute("TRUNCATE TABLE schedules RESTART IDENTITY CASCADE")
        cursor.executemany(insert_query, values)
    conn.commit()
    print(f"{len(values)} enregistrements de schedules chargés.")


def load_feedbacks(conn: _connection) -> None:
    path = file_path("feedbacks.csv")
    feedbacks_df = read_csv_with_encodings(path)
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
        (
            int(row.id),
            int(row.etudiant_id),
            str(row.texte),
            str(row.sentiment),
            row.timestamp.to_pydatetime(),
        )
        for row in feedbacks_df.itertuples(index=False)
    ]

    with conn.cursor() as cursor:
        cursor.executemany(insert_query, values)
    conn.commit()
    print(f"{len(values)} enregistrements de feedbacks chargés.")


def main() -> None:
    print("Connexion à la base de données PostgreSQL...")
    print(f"  host={DB_CONFIG['host']} port={DB_CONFIG['port']} db={DB_CONFIG['database']} user={DB_CONFIG['user']}")

    with connect() as conn:
        ensure_schema(conn)
        load_locations(conn)
        load_flux(conn)
        load_schedules(conn)
        load_feedbacks(conn)

    print("Chargement terminé.")


if __name__ == "__main__":
    main()
