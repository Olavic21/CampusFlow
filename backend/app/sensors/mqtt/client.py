"""
Client MQTT — prêt pour ESP32 / Raspberry Pi.
Active uniquement si MQTT_BROKER_URL est configuré et paho-mqtt installé.
"""
import json
import logging
from datetime import datetime

from app.config import settings
from app.database.session import SessionLocal
from app.sensors.services.ingest import ingest_sensor_reading
from app.sensors.websocket.hub import occupancy_hub

logger = logging.getLogger("campusflow.sensors.mqtt")


def _on_message(client, userdata, msg):  # noqa: ARG001
    try:
        data = json.loads(msg.payload.decode("utf-8"))
        location_id = int(data["building_id"])
        occupancy = int(data["occupancy"])
        confidence = float(data.get("confidence_score", 1.0))
        sensor_id = data.get("sensor_id")
        with SessionLocal() as db:
            payload = ingest_sensor_reading(
                db,
                location_id=location_id,
                occupancy=occupancy,
                sensor_id=sensor_id,
                confidence_score=confidence,
                source="mqtt",
                timestamp=datetime.utcnow(),
            )
            db.commit()
        import asyncio

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(occupancy_hub.broadcast(payload))
        except RuntimeError:
            pass
    except Exception:
        logger.exception("Message MQTT invalide : %s", msg.payload[:200])


def start_mqtt_listener() -> bool:
    if not settings.MQTT_BROKER_URL:
        logger.info("MQTT désactivé — MQTT_BROKER_URL non configuré")
        return False
    try:
        import paho.mqtt.client as mqtt  # type: ignore[import-untyped]
    except ImportError:
        logger.warning("paho-mqtt non installé — pip install paho-mqtt pour activer MQTT")
        return False

    client = mqtt.Client()
    client.on_message = _on_message
    try:
        host, _, port = settings.MQTT_BROKER_URL.replace("mqtt://", "").partition(":")
        client.connect(host, int(port or 1883), 60)
        client.subscribe(settings.MQTT_TOPIC)
        client.loop_start()
        logger.info("MQTT connecté — %s topic=%s", settings.MQTT_BROKER_URL, settings.MQTT_TOPIC)
        return True
    except Exception:
        logger.exception("Échec connexion MQTT")
        return False
