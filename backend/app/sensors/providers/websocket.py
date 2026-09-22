from typing import Any

from sqlalchemy.orm import Session

from app.sensors.providers.base import BaseSensorProvider
from app.sensors.services.ingest import get_latest_readings_from_db


class WebSocketProvider(BaseSensorProvider):
    """Flux poussé en temps réel via /ws/live-occupancy/."""

    @property
    def mode(self) -> str:
        return "websocket"

    @property
    def is_real(self) -> bool:
        return True

    def get_label(self) -> str:
        return "Données WebSocket"

    def get_latest_occupancy(self, db: Session) -> list[dict[str, Any]]:
        return get_latest_readings_from_db(db)


class HybridProvider(BaseSensorProvider):
    """Mode hybride — simulateur actif pour les bâtiments sans capteur réel.

    Les lectures réelles (api/mqtt) coexistent avec la simulation :
    la plus récente par bâtiment gagne (lecture unifiée).
    """

    @property
    def mode(self) -> str:
        return "hybrid"

    @property
    def is_real(self) -> bool:
        return True

    def get_label(self) -> str:
        return "Mode Hybride (réel + simulation)"

    def get_latest_occupancy(self, db: Session) -> list[dict[str, Any]]:
        return get_latest_readings_from_db(db)
