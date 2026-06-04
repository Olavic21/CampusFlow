"""
congestion_service.py — Calcul du niveau de congestion par salle.

Source : derniers enregistrements de la table flux (colonne nombre_etudiants
et niveau_congestion), avec cache Redis 60 s.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.utils.redis_client import redis_client
from app.database.models import Flux, Location
import json


def get_congestion(db: Session, location_id: int = None) -> list[dict]:
    """
    Retourne le niveau de congestion courant par salle.

    Stratégie :
    1. Cherche dans le cache Redis (TTL 60 s).
    2. Sinon, calcule depuis les flux des 5 dernières minutes.
    """
    # ── Cache Redis ───────────────────────────────────────────────────────────
    if location_id:
        cached = redis_client.get(f"congestion:{location_id}")
        if cached:
            return [json.loads(cached)]
    else:
        try:
            cached_list = []
            scan = getattr(redis_client, "scan_iter", None)
            if callable(scan):
                for key in scan("congestion:*", count=50):
                    raw = redis_client.get(key)
                    if raw:
                        cached_list.append(json.loads(raw))
            if cached_list:
                return cached_list
        except Exception:
            pass

    # ── Calcul depuis PostgreSQL ──────────────────────────────────────────────
    since = datetime.utcnow() - timedelta(minutes=5)

    query = (
        db.query(
            Flux.location_id,
            func.avg(Flux.nombre_etudiants).label("avg_students"),
            func.max(Flux.timestamp).label("last_update"),
        )
        .filter(Flux.timestamp >= since)
    )

    if location_id:
        query = query.filter(Flux.location_id == location_id)

    results = query.group_by(Flux.location_id).all()

    congestion_data = []
    for loc_id, avg_students, last_update in results:
        location = db.query(Location).filter(Location.id == loc_id).first()
        if not location:
            continue

        occupancy_rate = min(float(avg_students) / float(location.capacite), 1.0)

        if occupancy_rate < 0.3:
            level = "low"
        elif occupancy_rate < 0.6:
            level = "medium"
        elif occupancy_rate < 0.85:
            level = "high"
        else:
            level = "critical"

        data = {
            "location_id":    loc_id,
            "level":          level,
            "occupancy_rate": round(occupancy_rate, 2),
            "current_count":  int(avg_students),
            "updated_at":     (last_update or datetime.utcnow()).isoformat(),
        }
        congestion_data.append(data)
        redis_client.setex(f"congestion:{loc_id}", 60, json.dumps(data))

    return congestion_data
