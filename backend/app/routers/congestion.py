from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.congestion_service import get_congestion
from app.schemas.congestion import CongestionResponse
from app.utils.cache import cache_get, cache_set

router = APIRouter(prefix="/congestion", tags=["congestion"])
CONGESTION_CACHE_TTL = 30


@router.get("", response_model=list[CongestionResponse])
def get_congestion_endpoint(location_id: int = None, db: Session = Depends(get_db)):
    cache_key = f"congestion:{location_id or 'all'}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        result = get_congestion(db, location_id)
        if location_id and not result:
            raise HTTPException(404, "Location not found")
        out = [CongestionResponse.model_validate(r) for r in result]
        cache_set(cache_key, out, CONGESTION_CACHE_TTL)
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, f"Redis unavailable or error: {str(e)}") from e