from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.dashboard_service import get_dashboard_stats
from app.schemas.dashboard import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=DashboardStats)
def stats(period: str = "week", db: Session = Depends(get_db)):
    return get_dashboard_stats(db, period)