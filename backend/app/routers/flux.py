from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database.session import get_db
from app.services.flux_service import get_live_flux, get_flux_history
from app.schemas.flux import FluxLiveResponse, FluxHistoryResponse

router = APIRouter(prefix="/flux", tags=["flux"])


@router.get("/live", response_model=list[FluxLiveResponse])
def live_flux(
    window: int = Query(5, ge=1, le=60, description="Fenêtre temporelle en minutes"),
    db: Session = Depends(get_db),
):
    """Flux en temps réel pour toutes les salles sur la dernière fenêtre."""
    return get_live_flux(db, window)


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
        from_date = datetime.utcnow().replace(hour=0, minute=0, second=0) - timedelta(days=7)
    if not to_date:
        to_date = datetime.utcnow()

    data = get_flux_history(db, location_id, from_date, to_date, granularity)
    return {
        "location_id": location_id,
        "period":      {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "granularity": granularity,
        "data":        data,
    }
