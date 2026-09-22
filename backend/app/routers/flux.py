from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from app.database.session import get_db
from app.services.flux_service import get_live_flux, get_flux_history
from app.services.data_quality import is_stale
from app.schemas.flux import FluxLiveResponse, FluxHistoryResponse
from app.utils.cache import cache_get, cache_set

router = APIRouter(prefix="/flux", tags=["flux"])


@router.get("/live", response_model=list[FluxLiveResponse])
def live_flux(
    window: int = Query(5, ge=1, le=60, description="Fenêtre temporelle en minutes"),
    db: Session = Depends(get_db),
):
    """Flux en temps réel pour toutes les salles sur la dernière fenêtre.

    Chaque item est qualifié : `is_stale` (lecture au-delà du seuil),
    `source` (flux / simulation / api / mqtt) — voir data_quality.py.
    """
    cache_key = f"flux:live:{window}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    result = get_live_flux(db, window)
    now = datetime.now(tz=timezone.utc)
    out = []
    for r in result:
        ts = r.get("timestamp")
        try:
            dt = datetime.fromisoformat(ts) if isinstance(ts, str) else ts
        except (ValueError, TypeError):
            dt = None
        out.append(
            FluxLiveResponse(
                location_id=r["location_id"],
                nombre_etudiants=r["nombre_etudiants"],
                timestamp=dt or now,
                is_stale=is_stale(dt, now),
                source="flux",
                confidence_score=1.0,
            )
        )
    cache_set(cache_key, out, ttl_seconds=15)
    return out


@router.get("/history/{location_id}", response_model=FluxHistoryResponse)
def flux_history(
    location_id: int,
    from_date:   datetime = Query(None),
    to_date:     datetime = Query(None),
    granularity: str      = Query("hour", regex="^(hour|day|week)$"),
    db: Session = Depends(get_db),
):
    """Historique de flux agrégé par intervalle pour une salle."""
    if not from_date:
        from_date = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0) - timedelta(days=7)
    if not to_date:
        to_date = datetime.now(tz=timezone.utc)

    data = get_flux_history(db, location_id, from_date, to_date, granularity)
    return {
        "location_id": location_id,
        "period":      {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "granularity": granularity,
        "data":        data,
    }
