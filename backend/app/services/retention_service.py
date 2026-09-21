"""
retention_service.py — Purge des séries temporelles au-delà de RETENTION_DAYS.

Sans purge, le simulateur (76 lignes / 10 s) gonfle la base de ~650 k
lignes/jour en dev SQLite. La purge tourne au démarrage puis toutes les 6 h.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import Flux, SensorReading

logger = logging.getLogger("campusflow.retention")


def purge_old_data(db: Session, days: int | None = None) -> int:
    days = days or settings.RETENTION_DAYS
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)
    n_flux = (
        db.query(Flux).filter(Flux.timestamp < cutoff).delete(synchronize_session=False)
    )
    n_readings = (
        db.query(SensorReading)
        .filter(SensorReading.timestamp < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    if n_flux or n_readings:
        logger.info(
            "Rétention : %d flux + %d lectures supprimés (> %d jours)",
            n_flux,
            n_readings,
            days,
        )
    return n_flux + n_readings


async def retention_loop(interval_hours: int = 6) -> None:
    # Petite pause pour laisser le démarrage se terminer proprement
    await asyncio.sleep(30)
    while True:
        try:
            from app.database.session import SessionLocal

            with SessionLocal() as db:
                purge_old_data(db)
        except Exception:
            logger.exception("Erreur purge rétention")
        await asyncio.sleep(interval_hours * 3600)