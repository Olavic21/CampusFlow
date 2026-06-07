from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.sensors.providers.base import BaseSensorProvider
from app.sensors.services.ingest import get_latest_readings_from_db


class SimulationProvider(BaseSensorProvider):
    @property
    def mode(self) -> str:
        return "simulation"

    def get_label(self) -> str:
        return "Mode Simulation"

    def get_latest_occupancy(self, db: Session) -> list[dict[str, Any]]:
        return get_latest_readings_from_db(db, source_filter="simulation")
