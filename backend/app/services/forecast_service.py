"""
forecast_service.py — Prévision d'occupation 24 h par bâtiment.

Approche volontairement SANS modèle ML (audit §15) : le besoin utilisateur est
« puis-je y aller dans 1 h ? » et un profil horaire historique par jour de
semaine y répond de façon déterministe et explicable. Chaque point est
qualifié `PREDICTED` avec une bande min/max et un taux d'échantillonnage.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import Flux, Location

SAMPLES_DAYS = 90
SAMPLES_PER_HOUR_FOR_FULL_CONFIDENCE = 20


def forecast_24h(db: Session, location_id: int) -> dict:
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise ValueError(f"Salle introuvable : {location_id}")

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=SAMPLES_DAYS)
    rows = (
        db.query(
            Flux.heure_du_jour,
            func.avg(Flux.nombre_etudiants).label("avg"),
            func.min(Flux.nombre_etudiants).label("min"),
            func.max(Flux.nombre_etudiants).label("max"),
            func.count(Flux.id).label("n"),
        )
        .filter(Flux.location_id == location_id, Flux.timestamp >= cutoff)
        .group_by(Flux.heure_du_jour)
        .all()
    )
    by_hour = {
        h: {"avg": float(a or 0), "min": int(mn or 0), "max": int(mx or 0), "n": int(n or 0)}
        for h, a, mn, mx, n in rows
    }

    now = datetime.now(tz=timezone.utc)
    points = []
    for i in range(24):
        hour = (now.hour + i) % 24
        stat = by_hour.get(hour)
        if stat and stat["n"] > 0:
            points.append({
                "hour": hour,
                "predicted": round(stat["avg"], 1),
                "min": stat["min"],
                "max": stat["max"],
                "samples": stat["n"],
            })
        else:
            points.append({
                "hour": hour,
                "predicted": None,
                "min": None,
                "max": None,
                "samples": 0,
            })

    total_samples = sum(p["samples"] for p in points)
    confidence = round(
        min(1.0, total_samples / (24 * SAMPLES_PER_HOUR_FOR_FULL_CONFIDENCE)), 2
    )

    return {
        "location_id": location_id,
        "nom": loc.nom,
        "capacite": loc.capacite,
        "generated_at": now.isoformat(),
        "source": "PREDICTED",
        "method": "profil_horaire_historique",
        "confidence": confidence,
        "points": points,
    }