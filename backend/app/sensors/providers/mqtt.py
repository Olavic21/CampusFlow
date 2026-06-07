from typing import Any

from sqlalchemy.orm import Session

from app.sensors.providers.base import BaseSensorProvider
from app.sensors.services.ingest import get_latest_readings_from_db


class MQTTProvider(BaseSensorProvider):
    """Prêt pour ESP32 / Raspberry Pi via broker MQTT."""

    @property
    def mode(self) -> str:
        return "mqtt"

    @property
    def is_real(self) -> bool:
        return True

    def get_label(self) -> str:
        return "Données MQTT"

    def get_latest_occupancy(self, db: Session) -> list[dict[str, Any]]:
        return get_latest_readings_from_db(db, source_filter="mqtt")
