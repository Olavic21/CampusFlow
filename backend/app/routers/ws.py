import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database.session import SessionLocal
from app.sensors.services.sensor_data_provider import SensorDataProvider
from app.sensors.websocket.hub import occupancy_hub

logger = logging.getLogger("campusflow.sensors.ws")
router = APIRouter(tags=["websocket"])

_provider = SensorDataProvider()


@router.websocket("/ws/live-occupancy/")
async def live_occupancy_ws(websocket: WebSocket):
    """
    Flux temps réel d'occupation.
    Aujourd'hui : alimenté par le simulateur.
    Demain : capteurs ESP32 / MQTT / API.
    """
    await occupancy_hub.connect(websocket)
    try:
        with SessionLocal() as db:
            readings = _provider.get_occupancy(db)
        if readings:
            await websocket.send_text(
                json.dumps({"type": "occupancy_snapshot", "readings": readings})
            )

        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("WebSocket occupancy error")
    finally:
        await occupancy_hub.disconnect(websocket)
