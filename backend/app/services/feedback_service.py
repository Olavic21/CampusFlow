"""
feedback_service.py — Lecture des feedbacks étudiants.
"""
from sqlalchemy.orm import Session
from app.database.models import Feedback


def get_feedbacks(
    db: Session,
    etudiant_id: int = None,
    sentiment: str = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, list]:
    q = db.query(Feedback)
    if etudiant_id:
        q = q.filter(Feedback.etudiant_id == etudiant_id)
    if sentiment:
        q = q.filter(Feedback.sentiment == sentiment)
    total = q.count()
    items = q.order_by(Feedback.timestamp.desc()).offset(offset).limit(limit).all()
    return total, items
