from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.path_service import find_path
from app.services.congestion_service import get_congestion
from app.schemas.path import PathResponse

router = APIRouter(prefix="/path", tags=["path"])

@router.get("", response_model=PathResponse)
def get_path(
    from_id: int = Query(..., alias="from"),
    to_id: int = Query(..., alias="to"),
    avoid_congestion: bool = False,
    db: Session = Depends(get_db)
):
    if from_id == to_id:
        raise HTTPException(400, "Source and destination must be different")
    path_data = find_path(db, from_id, to_id, avoid_congestion, get_congestion)
    if not path_data:
        raise HTTPException(409, "No path found between these buildings")
    return path_data