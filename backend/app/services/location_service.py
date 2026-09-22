from sqlalchemy.orm import Session
from app.database.models import Location


def get_all_locations(db: Session, type_filter: str = None) -> list:
    """Retourne toutes les salles (pas de filtre is_active : absent du schema SQL)."""
    query = db.query(Location)
    if type_filter:
        query = query.filter(Location.type == type_filter)
    return query.all()
