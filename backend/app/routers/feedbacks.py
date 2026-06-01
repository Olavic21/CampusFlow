from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.feedback_service import get_feedbacks
from app.schemas.feedback import FeedbackListResponse

router = APIRouter(prefix="/feedbacks", tags=["feedbacks"])


@router.get("", response_model=FeedbackListResponse)
def list_feedbacks(
    etudiant_id: int = Query(None, description="Filtrer par étudiant"),
    sentiment:   str = Query(None, description="positive | negative | neutral"),
    limit:       int = Query(20, ge=1, le=100),
    offset:      int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    total, items = get_feedbacks(db, etudiant_id, sentiment, limit, offset)
    return {"total": total, "limit": limit, "offset": offset, "items": items}
