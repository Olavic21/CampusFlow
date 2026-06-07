"""
Moteur de simulation — reproduit le comportement futur des capteurs physiques.
Variations réalistes : montée matin, baisse midi, pic après-midi, baisse soir.
"""
import asyncio
import json
import logging
import random
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import Location
from app.database.session import SessionLocal
from app.sensors.services.ingest import ingest_sensor_reading
from app.sensors.websocket.hub import occupancy_hub

logger = logging.getLogger("campusflow.sensors.simulator")

# Courbe journalière (fraction de capacité)
_HOURLY_CURVE = {
    0: 0.02, 1: 0.01, 2: 0.01, 3: 0.01, 4: 0.01, 5: 0.02, 6: 0.05,
    7: 0.25, 8: 0.55, 9: 0.75, 10: 0.85, 11: 0.90,
    12: 0.50, 13: 0.45, 14: 0.70, 15: 0.85, 16: 0.80, 17: 0.60,
    18: 0.35, 19: 0.15, 20: 0.08, 21: 0.05, 22: 0.03, 23: 0.02,
}


class SensorSimulator:
    def __init__(self) -> None:
        self._capteurs_index: dict[tuple[int, int, int], int] = {}
        self._load_capteurs_json()

    def _load_capteurs_json(self) -> None:
        path: Path = settings.CAPTEURS_JSON_PATH
        if not path.is_file():
            logger.warning("capteurs.json introuvable : %s — courbe horaire utilisée", path)
            return
        try:
            with path.open(encoding="utf-8") as f:
                data = json.load(f)
            for snap in data:
                key = (snap["location_id"], snap["heure"], snap["minute"])
                self._capteurs_index[key] = snap["nombre_etudiants"]
            logger.info("Simulateur : %d snapshots capteurs.json chargés", len(data))
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Erreur lecture capteurs.json : %s", e)

    def _occupancy_for(self, loc: Location, now: datetime) -> int:
        minute_slot = 30 if now.minute >= 30 else 0
        key = (loc.id, now.hour, minute_slot)
        if key in self._capteurs_index:
            base = self._capteurs_index[key]
        else:
            frac = _HOURLY_CURVE.get(now.hour, 0.3)
            base = int(loc.capacite * frac)

        # Bruit ±10 % pour simuler un capteur réel
        noise = random.uniform(0.9, 1.1)
        count = int(base * noise)
        return max(0, min(loc.capacite, count))

    def generate_tick(self, db: Session) -> list[dict]:
        now = datetime.utcnow()
        payloads = []
        for loc in db.query(Location).order_by(Location.id).all():
            occ = self._occupancy_for(loc, now)
            payload = ingest_sensor_reading(
                db,
                location_id=loc.id,
                occupancy=occ,
                confidence_score=round(random.uniform(0.88, 0.99), 2),
                source="simulation",
                timestamp=now,
            )
            payloads.append(payload)
        db.commit()
        return payloads

    async def run_forever(self) -> None:
        interval = max(3, settings.SENSOR_SIM_INTERVAL_SEC)
        logger.info("Simulateur IoT démarré — intervalle %ds", interval)
        while True:
            try:
                with SessionLocal() as db:
                    payloads = self.generate_tick(db)
                if payloads:
                    await occupancy_hub.broadcast_batch(payloads)
            except Exception:
                logger.exception("Erreur tick simulateur")
            await asyncio.sleep(interval)


_simulator: SensorSimulator | None = None


def get_simulator() -> SensorSimulator:
    global _simulator
    if _simulator is None:
        _simulator = SensorSimulator()
    return _simulator
