"""Point d'entrée unique — abstraction source de données capteurs."""
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import Sensor, SensorReading
from app.sensors.providers import (
    APIProvider,
    BaseSensorProvider,
    HybridProvider,
    MQTTProvider,
    SimulationProvider,
    WebSocketProvider,
)
from app.sensors.services.ingest import (
    get_last_sync_or_db,
    get_readings_count_or_db,
)
from app.services import data_quality as dq

_PROVIDERS: dict[str, type[BaseSensorProvider]] = {
    "simulation": SimulationProvider,
    "api": APIProvider,
    "mqtt": MQTTProvider,
    "websocket": WebSocketProvider,
    "hybrid": HybridProvider,
}

_active: BaseSensorProvider | None = None


def get_sensor_provider() -> BaseSensorProvider:
    global _active
    mode = settings.SENSOR_MODE
    if mode not in _PROVIDERS:
        mode = "simulation"
    if _active is None or _active.mode != mode:
        _active = _PROVIDERS[mode]()
    return _active


def effective_status(sensor: Sensor, now=None) -> str:
    """
    Statut effectif d'un capteur — 'online' uniquement si last_seen est récent
    (heartbeat). Un capteur muet depuis SENSOR_HEARTBEAT_OFFLINE_SEC = offline.
    """
    if sensor.status == "maintenance":
        return "maintenance"
    age = dq.age_seconds(sensor.last_seen, now)
    if age is None or age > settings.SENSOR_HEARTBEAT_OFFLINE_SEC:
        return "offline"
    return sensor.status or "online"


class SensorDataProvider:
    """Façade — l'application ne connaît pas la source réelle."""

    def __init__(self, provider: BaseSensorProvider | None = None) -> None:
        self._provider = provider or get_sensor_provider()

    @property
    def mode(self) -> str:
        return self._provider.mode

    @property
    def is_real(self) -> bool:
        return self._provider.is_real

    def get_mode_info(self) -> dict[str, Any]:
        return {
            "mode": self._provider.mode,
            "is_real": self._provider.is_real,
            "label": self._provider.get_label(),
            "description": (
                "Données provenant de capteurs physiques"
                if self._provider.is_real
                else "Données générées par le simulateur (capteurs.json)"
            ),
        }

    def get_occupancy(self, db: Session) -> list[dict[str, Any]]:
        return self._provider.get_latest_occupancy(db)

    def ingest_test_data(self, db: Session, **kwargs) -> dict[str, Any]:
        return self._provider.ingest(db, source="api", **kwargs)

    def get_dashboard(self, db: Session) -> dict[str, Any]:
        from app.database.models import SensorReading

        since = get_last_sync_or_db(db)
        sensors = db.query(Sensor).all()
        active = sum(
            1 for s in sensors if effective_status(s) == "online"
        )
        total = len(sensors)
        readings_db = db.query(func.count(SensorReading.id)).scalar() or 0
        info = self.get_mode_info()
        return {
            **info,
            "active_sensors": active,
            "total_sensors": total,
            "readings_received": max(get_readings_count_or_db(db), readings_db),
            "last_sync": since,
        }

    def list_sensors(self, db: Session) -> list[Sensor]:
        return db.query(Sensor).order_by(Sensor.id).all()
