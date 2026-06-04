"""
seed.py — Données de dev alignées sur data/raw/campus.json (38 bâtiments SUP'PTIC).

Usage (depuis backend/) :
    python -m app.utils.seed
"""
import json
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database.session import SessionLocal, engine, Base
from app.database.models import Location, Flux, Feedback
import app.database.models  # noqa: F401

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "raw"
CAMPUS_JSON = DATA_DIR / "campus.json"
CAPTEURS_JSON = DATA_DIR / "capteurs.json"


def seed_database(db: Session) -> None:
    db.query(Flux).delete()
    db.query(Feedback).delete()
    db.query(Location).delete()
    db.commit()

    if not CAMPUS_JSON.exists():
        raise FileNotFoundError(f"campus.json introuvable : {CAMPUS_JSON}")

    with CAMPUS_JSON.open(encoding="utf-8") as f:
        buildings = json.load(f)

    for b in buildings:
        db.add(Location(
            id=b["id"],
            nom=b["nom"],
            latitude=b["latitude"],
            longitude=b["longitude"],
            capacite=b["capacite"],
            type=b["type"],
        ))
    db.commit()

    # Flux récents : capteurs.json remappés sur les 2 derniers jours (pour /flux/live)
    now = datetime.utcnow()
    if CAPTEURS_JSON.exists():
        with CAPTEURS_JSON.open(encoding="utf-8") as f:
            capteurs = json.load(f)
        ref = datetime(2024, 10, 7)
        count = 0
        for snap in capteurs:
            for day_offset in (0, 1):
                ts = now.replace(
                    hour=snap["heure"], minute=snap["minute"], second=0, microsecond=0
                ) - timedelta(days=day_offset)
                loc = next((b for b in buildings if b["id"] == snap["location_id"]), None)
                if not loc:
                    continue
                n = snap["nombre_etudiants"]
                ratio = n / loc["capacite"] if loc["capacite"] else 0
                niveau = "faible" if ratio < 0.3 else ("moyen" if ratio <= 0.7 else "eleve")
                db.add(Flux(
                    location_id=snap["location_id"],
                    timestamp=ts,
                    nombre_etudiants=n,
                    activite_prevue=1 if 8 <= snap["heure"] <= 18 else 0,
                    heure_du_jour=snap["heure"],
                    jour_semaine=min(ts.weekday(), 5),
                    niveau_congestion=niveau,
                ))
                count += 1
        db.commit()
        print(f"  {count} enregistrements flux (capteurs remappés)")
    else:
        # Fallback : générer flux récents pour chaque bâtiment
        now = datetime.utcnow()
        for loc in db.query(Location).all():
            for h in range(-48, 0):
                ts = now + timedelta(hours=h)
                n = max(0, min(loc.capacite, int(loc.capacite * 0.4)))
                ratio = n / loc.capacite
                niveau = "faible" if ratio < 0.3 else ("moyen" if ratio <= 0.7 else "eleve")
                db.add(Flux(
                    location_id=loc.id,
                    timestamp=ts,
                    nombre_etudiants=n,
                    activite_prevue=1 if 8 <= ts.hour <= 17 else 0,
                    heure_du_jour=ts.hour,
                    jour_semaine=min(ts.weekday(), 5),
                    niveau_congestion=niveau,
                ))
        db.commit()

    # Feedbacks de démo
    now = datetime.utcnow()
    for i in range(30):
        db.add(Feedback(
            etudiant_id=1000 + i,
            texte=f"Retour étudiant SUP'PTIC #{i + 1}",
            sentiment=["positive", "negative", "neutral"][i % 3],
            timestamp=now - timedelta(days=i % 14),
        ))
    db.commit()

    n_loc = db.query(Location).count()
    n_flux = db.query(Flux).count()
    print(f"Seed terminé : {n_loc} bâtiments SUP'PTIC, {n_flux} flux, 30 feedbacks.")


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
