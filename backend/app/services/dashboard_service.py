"""
dashboard_service.py — Statistiques globales pour le tableau de bord frontend.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, cast, Float
from app.database.models import Flux, Feedback, Location
from datetime import datetime, timedelta


def get_dashboard_stats(db: Session, period: str = "week") -> dict:
    end = datetime.utcnow()
    if period == "day":
        start = end - timedelta(days=1)
    elif period == "week":
        start = end - timedelta(days=7)
    else:  # month
        start = end - timedelta(days=30)

    # ── Top 5 salles les plus chargées ────────────────────────────────────────
    top_locs = (
        db.query(
            Flux.location_id,
            Location.nom,
            func.avg(
                cast(Flux.nombre_etudiants, Float) / cast(Location.capacite, Float)
            ).label("congestion_rate"),
        )
        .join(Location, Location.id == Flux.location_id)
        .filter(Flux.timestamp >= start)
        .group_by(Flux.location_id, Location.nom)
        .order_by(desc("congestion_rate"))
        .limit(5)
        .all()
    )
    top_locations = [
        {"id": t[0], "name": t[1], "avg_congestion": round(float(t[2] or 0), 2)}
        for t in top_locs
    ]

    # ── Heures de pointe (depuis la colonne dénormalisée heure_du_jour) ───────
    peak_q = (
        db.query(
            Flux.heure_du_jour,
            func.avg(Flux.nombre_etudiants).label("avg_students"),
        )
        .filter(Flux.timestamp >= start)
        .group_by(Flux.heure_du_jour)
        .order_by(desc("avg_students"))
        .limit(5)
        .all()
    )
    peak_hours = [{"hour": int(h), "avg_students": int(cnt or 0)} for h, cnt in peak_q]

    # ── Congestion par jour de semaine (depuis la colonne dénormalisée) ───────
    day_q = (
        db.query(
            Flux.jour_semaine,
            func.avg(Flux.nombre_etudiants).label("avg_students"),
        )
        .filter(Flux.timestamp >= start)
        .group_by(Flux.jour_semaine)
        .order_by(Flux.jour_semaine)
        .all()
    )
    days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
    avg_congestion_by_day = [
        {
            "day": days[int(d)] if 0 <= int(d) < len(days) else str(d),
            "avg_students": int(avg or 0),
        }
        for d, avg in day_q
    ]

    # ── Résumé des feedbacks ──────────────────────────────────────────────────
    feedback_q = (
        db.query(Feedback.sentiment, func.count().label("cnt"))
        .filter(Feedback.timestamp >= start)
        .group_by(Feedback.sentiment)
        .all()
    )
    summary = {"positive": 0, "negative": 0, "neutral": 0}
    for sent, cnt in feedback_q:
        if sent in summary:
            summary[sent] = int(cnt)

    # ── Total flux ────────────────────────────────────────────────────────────
    total_flux = (
        db.query(func.sum(Flux.nombre_etudiants))
        .filter(Flux.timestamp >= start)
        .scalar()
        or 0
    )

    return {
        "top_locations":         top_locations,
        "peak_hours":            peak_hours,
        "avg_congestion_by_day": avg_congestion_by_day,
        "feedback_summary":      summary,
        "total_flux":            int(total_flux),
    }
