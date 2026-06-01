from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database.models import Flux

def get_live_flux(db: Session, window_minutes: int = 5):
    since = datetime.utcnow() - timedelta(minutes=window_minutes)
    results = db.query(
        Flux.location_id,
        func.sum(Flux.entries).label("entries"),
        func.sum(Flux.exits).label("exits"),
        func.max(Flux.timestamp).label("timestamp")
    ).filter(Flux.timestamp >= since)\
     .group_by(Flux.location_id).all()

    return [
        {
            "location_id": r.location_id,
            "entries": r.entries,
            "exits": r.exits,
            "net_flow": r.entries - r.exits,
            "timestamp": r.timestamp.isoformat()
        }
        for r in results
    ]

def get_flux_history(db: Session, location_id: int, from_date: datetime, to_date: datetime, granularity: str):
    # Simuler selon granularité : heure par défaut
    q = db.query(
        func.date_trunc(granularity, Flux.timestamp).label("interval"),
        func.avg(Flux.count).label("count"),
        func.sum(Flux.entries).label("entries"),
        func.sum(Flux.exits).label("exits")
    ).filter(Flux.location_id == location_id,
             Flux.timestamp.between(from_date, to_date))\
     .group_by("interval").order_by("interval")

    data = []
    for row in q.all():
        # Handle SQLite returning strings from date_trunc instead of datetime objects
        ts = row.interval.isoformat() if hasattr(row.interval, 'isoformat') else row.interval
        data.append({
            "timestamp": ts, "count": int(row.count),
            "entries": int(row.entries), "exits": int(row.exits)
        })
    return data