from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone

from app.database.session import get_db
from app.database.models import Location, Flux
from app.services.location_service import get_all_locations
from app.services.data_quality import is_stale
from app.schemas.location import LocationOut, LocationFreeOut
from app.utils.cache import cache_get, cache_set

router = APIRouter(prefix="/locations", tags=["locations"])

LOCATIONS_CACHE_TTL = 120
FREE_CACHE_TTL = 60


@router.get("", response_model=list[LocationOut])
def get_locations(
    type: str = Query(None, description="Filtrer par type de salle"),
    db: Session = Depends(get_db),
):
    cache_key = f"locations:{type or 'all'}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    rows = get_all_locations(db, type)
    out = [LocationOut.model_validate(r) for r in rows]
    cache_set(cache_key, out, LOCATIONS_CACHE_TTL)
    return out


@router.get("/free", response_model=list[LocationFreeOut])
def get_free_locations(
    limit: int = Query(8, ge=1, le=38, description="Nombre max de résultats"),
    db: Session = Depends(get_db),
):
    """
    « Salle libre maintenant » (Phase 3) — bâtiments les plus libres sur la
    dernière fenêtre de 5 minutes (occupation < 40 % de la capacité).
    Un bâtiment sans lecture récente est volontairement EXCLU : inconnu ≠ libre.
    """
    cache_key = f"locations:free:{limit}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    since = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
    rows = (
        db.query(
            Location.id,
            Location.nom,
            Location.type,
            Location.capacite,
            Location.latitude,
            Location.longitude,
            func.avg(Flux.nombre_etudiants).label("avg_students"),
            func.max(Flux.timestamp).label("last_update"),
        )
        .join(Flux, Flux.location_id == Location.id)
        .filter(Flux.timestamp >= since)
        .group_by(Location.id)
        .having(func.avg(Flux.nombre_etudiants) < Location.capacite * 0.4)
        .order_by(func.avg(Flux.nombre_etudiants) / Location.capacite)
        .limit(limit)
        .all()
    )

    now = datetime.now(tz=timezone.utc)
    out = []
    for (
        loc_id,
        nom,
        type_,
        capacite,
        latitude,
        longitude,
        avg_students,
        last_update,
    ) in rows:
        count = int(avg_students or 0)
        out.append(
            LocationFreeOut(
                id=loc_id,
                nom=nom,
                type=type_,
                capacite=capacite,
                latitude=float(latitude) if latitude is not None else 0.0,
                longitude=float(longitude) if longitude is not None else 0.0,
                count=count,
                occupancy_rate=round(count / capacite, 2) if capacite else 0.0,
                last_update=last_update or now,
                is_stale=is_stale(last_update, now),
            )
        )
    cache_set(cache_key, out, FREE_CACHE_TTL)
    return out
