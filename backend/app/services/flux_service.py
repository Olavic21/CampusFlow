"""
flux_service.py — Flux en temps réel et historique.

Compatible PostgreSQL (date_trunc) et SQLite (strftime) pour les environnements
de dev/test.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from app.database.models import Flux
from app.database.session import engine


def _is_postgres() -> bool:
    return engine.dialect.name == "postgresql"


def get_live_flux(db: Session, window_minutes: int = 5) -> list[dict]:
    """Agrège les flux des `window_minutes` dernières minutes par salle."""
    since = datetime.utcnow() - timedelta(minutes=window_minutes)

    results = (
        db.query(
            Flux.location_id,
            func.sum(Flux.nombre_etudiants).label("total_students"),
            func.avg(Flux.nombre_etudiants).label("avg_students"),
            func.max(Flux.timestamp).label("timestamp"),
        )
        .filter(Flux.timestamp >= since)
        .group_by(Flux.location_id)
        .all()
    )

    return [
        {
            "location_id":   r.location_id,
            "nombre_etudiants": int(r.avg_students or 0),
            "timestamp":     r.timestamp.isoformat() if r.timestamp else datetime.utcnow().isoformat(),
        }
        for r in results
    ]


def get_flux_history(
    db: Session,
    location_id: int,
    from_date: datetime,
    to_date: datetime,
    granularity: str = "hour",
) -> list[dict]:
    """
    Historique agrégé par intervalle (hour | day | week).

    Compatible PostgreSQL et SQLite.
    """
    if _is_postgres():
        # PostgreSQL : date_trunc native
        interval_expr = func.date_trunc(granularity, Flux.timestamp)
    else:
        # SQLite : strftime comme fallback de dev
        fmt_map = {"hour": "%Y-%m-%dT%H:00:00", "day": "%Y-%m-%d", "week": "%Y-%W"}
        fmt = fmt_map.get(granularity, "%Y-%m-%dT%H:00:00")
        interval_expr = func.strftime(fmt, Flux.timestamp)

    query = (
        db.query(
            interval_expr.label("interval"),
            func.avg(Flux.nombre_etudiants).label("avg_students"),
            func.max(Flux.nombre_etudiants).label("max_students"),
            func.min(Flux.nombre_etudiants).label("min_students"),
        )
        .filter(
            Flux.location_id == location_id,
            Flux.timestamp.between(from_date, to_date),
        )
        .group_by("interval")
        .order_by("interval")
    )

    data = []
    for row in query.all():
        ts = row.interval.isoformat() if hasattr(row.interval, "isoformat") else str(row.interval)
        data.append({
            "timestamp":    ts,
            "avg_students": int(row.avg_students or 0),
            "max_students": int(row.max_students or 0),
            "min_students": int(row.min_students or 0),
        })
    return data
