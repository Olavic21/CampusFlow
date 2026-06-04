from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.location_service import get_all_locations
from app.schemas.location import LocationOut
from app.utils.cache import cache_get, cache_set

router = APIRouter(prefix="/locations", tags=["locations"])

LOCATIONS_CACHE_TTL = 120


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
