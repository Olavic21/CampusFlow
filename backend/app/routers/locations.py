from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.location_service import get_all_locations
from app.schemas.location import LocationOut

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationOut])
def get_locations(
    type: str = Query(None, description="Filtrer par type de salle"),
    db: Session = Depends(get_db),
):
    return get_all_locations(db, type)
