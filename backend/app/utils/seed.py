"""
seed.py — Données de test alignées sur le schéma SQL de data/db/schema.sql.

Utilisé uniquement en développement/test (SQLite ou PostgreSQL de dev).
"""
from sqlalchemy.orm import Session
from app.database.models import Location, Flux, Feedback, Schedule
from datetime import datetime, timedelta
import random


def seed_database(db: Session) -> None:
    # ── Nettoyage ─────────────────────────────────────────────────────────────
    db.query(Flux).delete()
    db.query(Feedback).delete()
    db.query(Schedule).delete()
    db.query(Location).delete()

    # ── Salles (campus SUP'PTIC approximatif) ─────────────────────────────────
    buildings = [
        ("Amphi A",       3.8620, 11.5220, 300, "amphi"),
        ("Salle C17",     3.8615, 11.5218, 60,  "salle"),
        ("Salle C16",     3.8613, 11.5216, 60,  "salle"),
        ("Salle B04",     3.8610, 11.5210, 40,  "salle"),
        ("Salle B12",     3.8612, 11.5214, 40,  "salle"),
        ("Bibliothèque",  3.8605, 11.5205, 120, "bibliotheque"),
        ("Administration",3.8600, 11.5200, 30,  "admin"),
    ]
    loc_objects = []
    for nom, lat, lon, cap, typ in buildings:
        loc = Location(nom=nom, latitude=lat, longitude=lon, capacite=cap, type=typ)
        db.add(loc)
        loc_objects.append(loc)
    db.commit()
    db.refresh(loc_objects[0])  # s'assurer que les IDs sont disponibles

    locations = db.query(Location).all()
    now = datetime.utcnow()

    # ── Flux sur 7 jours ──────────────────────────────────────────────────────
    for loc in locations:
        for delta_h in range(-168, 0, 1):
            ts = now + timedelta(hours=delta_h)
            hour = ts.hour
            jour = ts.weekday()   # 0=Lundi … 6=Dimanche (on ignore 6)

            base = 50 if 8 <= hour <= 18 else 10
            if loc.type == "amphi":
                base = 150 if 9 <= hour <= 12 else 20

            nombre = max(0, min(int(base + random.gauss(0, 15)), loc.capacite))
            activite = 1 if (8 <= hour <= 17 and jour <= 5) else 0

            # Niveau de congestion calculé
            ratio = nombre / loc.capacite
            if ratio < 0.3:
                niveau = "faible"
            elif ratio < 0.6:
                niveau = "moyen"
            else:
                niveau = "eleve"

            db.add(Flux(
                location_id=loc.id,
                timestamp=ts,
                nombre_etudiants=nombre,
                activite_prevue=activite,
                heure_du_jour=hour,
                jour_semaine=min(jour, 5),
                niveau_congestion=niveau,
            ))

    # ── Feedbacks ─────────────────────────────────────────────────────────────
    for i in range(60):
        db.add(Feedback(
            etudiant_id=random.randint(1000, 9999),
            texte="Commentaire de test généré automatiquement.",
            sentiment=random.choice(["positive", "negative", "neutral"]),
            timestamp=now - timedelta(days=random.randint(0, 30)),
        ))

    db.commit()
    print(f"Seed terminé : {len(locations)} salles, flux et feedbacks insérés.")
