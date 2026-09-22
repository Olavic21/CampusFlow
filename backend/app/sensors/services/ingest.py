"""Ingestion unifiée — SensorReading + Flux + mise à jour capteur."""
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.database.models import Flux, Location, Sensor, SensorReading
from app.services.congestion_levels import congestion_level_from_taux, db_value_for_level
from app.services import data_quality as dq

# Compteur global (dashboard IoT) — reset au restart, fallback DB prévu
_readings_count = 0
_last_sync: datetime | None = None


def get_readings_count() -> int:
    return _readings_count


def get_last_sync() -> datetime | None:
    return _last_sync


def get_readings_count_or_db(db: Session) -> int:
    """Compteur en mémoire, sinon comptage DB (survit au restart)."""
    if _readings_count:
        return _readings_count
    return db.query(func.count(SensorReading.id)).scalar() or 0


def get_last_sync_or_db(db: Session) -> datetime | None:
    """Dernière sync en mémoire, sinon max(timestamp) en DB."""
    if _last_sync:
        return _last_sync
    return db.query(func.max(SensorReading.timestamp)).scalar()


def _niveau_congestion(ratio: float) -> str:
    # Source canonique unique — voir app/services/congestion_levels.py
    return db_value_for_level(congestion_level_from_taux(ratio))


def _resolve_sensor(db: Session, location_id: int, sensor_id: int | None) -> Sensor | None:
    if sensor_id:
        return db.query(Sensor).filter(Sensor.id == sensor_id).first()
    return (
        db.query(Sensor)
        .filter(Sensor.location_id == location_id)
        .order_by(Sensor.id.asc())
        .first()
    )


def ingest_sensor_reading(
    db: Session,
    *,
    location_id: int,
    occupancy: int,
    sensor_id: int | None = None,
    confidence_score: float = 1.0,
    source: str = "simulation",
    timestamp: datetime | None = None,
) -> dict[str, Any]:
    global _readings_count, _last_sync

    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise ValueError(f"Bâtiment inconnu : {location_id}")

    ts = timestamp or datetime.now(tz=timezone.utc)
    sensor = _resolve_sensor(db, location_id, sensor_id)

    if sensor:
        sensor.last_seen = ts
        sensor.status = "online"
        if source != "simulation":
            sensor.source = source

    reading = SensorReading(
        sensor_id=sensor.id if sensor else None,
        location_id=location_id,
        timestamp=ts,
        occupancy=max(0, occupancy),
        confidence_score=confidence_score,
        source=source,
    )
    db.add(reading)

    ratio = occupancy / loc.capacite if loc.capacite else 0
    db.add(
        Flux(
            location_id=location_id,
            timestamp=ts,
            nombre_etudiants=max(0, occupancy),
            activite_prevue=1 if 8 <= ts.hour <= 18 else 0,
            heure_du_jour=ts.hour,
            jour_semaine=min(ts.weekday(), 5),
            niveau_congestion=_niveau_congestion(ratio),
        )
    )
    db.flush()

    _readings_count += 1
    _last_sync = ts

    payload = {
        "building_id": location_id,
        "occupancy": max(0, occupancy),
        "timestamp": ts.isoformat(),
        "source": source,
        "confidence_score": confidence_score,
    }
    return payload


def get_latest_readings_from_db(
    db: Session,
    *,
    window_minutes: int = 5,
) -> list[dict[str, Any]]:
    """
    Dernier état d'occupation par bâtiment — TOUTES sources confondues
    (simulation, api, mqtt, websocket). Les sources coexistent : la plus
    récente gagne, chaque lecture est qualifiée par `is_stale` / `source`
    (honnêteté des données — voir app/services/data_quality.py).
    """
    now = datetime.now(timezone.utc)

    # Dernier timestamp par bâtiment, toutes sources confondues
    sub = (
        db.query(
            SensorReading.location_id.label("loc_id"),
            func.max(SensorReading.timestamp).label("ts"),
        )
        .group_by(SensorReading.location_id)
        .subquery()
    )
    rows = (
        db.query(
            SensorReading.location_id,
            func.avg(SensorReading.occupancy).label("avg_occ"),
            func.max(SensorReading.timestamp).label("timestamp"),
            func.max(SensorReading.source).label("src"),
            func.avg(SensorReading.confidence_score).label("conf"),
        )
        .join(
            sub,
            and_(
                SensorReading.location_id == sub.c.loc_id,
                SensorReading.timestamp == sub.c.ts,
            ),
        )
        .group_by(SensorReading.location_id)
        .all()
    )

    if rows:
        return [
            {
                "building_id": r.location_id,
                "occupancy": int(r.avg_occ or 0),
                "timestamp": r.timestamp.isoformat() if r.timestamp else now.isoformat(),
                "source": r.src or "unknown",
                "confidence_score": float(r.conf or 1.0),
                "is_stale": dq.is_stale(r.timestamp, now),
            }
            for r in rows
        ]

    # Fallback : table flux si pas encore de sensor_readings
    from app.services.flux_service import get_live_flux

    result = []
    for r in get_live_flux(db, window_minutes):
        ts = r.get("timestamp")
        try:
            dt = datetime.fromisoformat(ts) if isinstance(ts, str) else ts
        except (ValueError, TypeError):
            dt = None
        result.append(
            {
                "building_id": r["location_id"],
                "occupancy": r["nombre_etudiants"],
                "timestamp": ts or now.isoformat(),
                "source": "flux",
                "confidence_score": 1.0,
                "is_stale": dq.is_stale(dt, now),
            }
        )
    return result


def ensure_sensors_seeded(db: Session) -> int:
    """Crée un capteur simulé par bâtiment si la table est vide."""
    if db.query(Sensor).count() > 0:
        return 0

    created = 0
    for loc in db.query(Location).order_by(Location.id).all():
        db.add(
            Sensor(
                name=f"SIM-{loc.id:03d}",
                location_id=loc.id,
                building=loc.nom,
                sensor_type="counter",
                status="online",
                source="simulation",
                last_seen=datetime.now(tz=timezone.utc),
            )
        )
        created += 1
    db.commit()
    return created
