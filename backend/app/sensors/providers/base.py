from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.orm import Session


class BaseSensorProvider(ABC):
    """Interface commune — simulation, API, MQTT, WebSocket."""

    @property
    @abstractmethod
    def mode(self) -> str:
        ...

    @property
    def is_real(self) -> bool:
        return self.mode not in ("simulation",)

    @abstractmethod
    def get_label(self) -> str:
        ...

    @abstractmethod
    def get_latest_occupancy(self, db: Session) -> list[dict[str, Any]]:
        """Retourne [{ building_id, occupancy, timestamp, source, confidence_score }, ...]."""
        ...

    def ingest(
        self,
        db: Session,
        *,
        location_id: int,
        occupancy: int,
        sensor_id: int | None = None,
        confidence_score: float = 1.0,
        source: str | None = None,
        timestamp=None,
    ) -> dict[str, Any]:
        from app.sensors.services.ingest import ingest_sensor_reading

        return ingest_sensor_reading(
            db,
            location_id=location_id,
            occupancy=occupancy,
            sensor_id=sensor_id,
            confidence_score=confidence_score,
            source=source or self.mode,
            timestamp=timestamp,
        )
