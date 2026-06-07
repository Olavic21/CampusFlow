"""Tests endpoints IoT / capteurs."""
from datetime import datetime

from app.database.models import Location, Sensor
from app.sensors.services.ingest import ensure_sensors_seeded


def _seed_location(db_session):
    loc = Location(
        nom="Amphi 200",
        latitude=3.8691,
        longitude=11.5083,
        capacite=200,
        type="amphi",
    )
    db_session.add(loc)
    db_session.commit()
    db_session.refresh(loc)
    return loc


def test_sensor_mode(client):
    response = client.get("/sensors/mode")
    assert response.status_code == 200
    data = response.json()
    assert "mode" in data
    assert "is_real" in data
    assert "label" in data


def test_list_sensors_after_seed(client, db_session):
    loc = _seed_location(db_session)
    ensure_sensors_seeded(db_session)
    response = client.get("/sensors")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["building"] == loc.nom
    assert data[0]["name"].startswith("SIM-")


def test_sensor_dashboard(client, db_session):
    _seed_location(db_session)
    ensure_sensors_seeded(db_session)
    response = client.get("/sensors/status")
    assert response.status_code == 200
    data = response.json()
    assert data["total_sensors"] >= 1
    assert "readings_received" in data
    assert "active_sensors" in data


def test_inject_test_data(client, db_session):
    loc = _seed_location(db_session)
    ensure_sensors_seeded(db_session)
    sensor = db_session.query(Sensor).filter(Sensor.location_id == loc.id).first()

    response = client.post(
        "/sensors/test-data",
        json={
            "building_id": loc.id,
            "occupancy": 17,
            "sensor_id": sensor.id,
            "confidence_score": 0.95,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["reading"]["building_id"] == loc.id
    assert body["reading"]["occupancy"] == 17

    dash = client.get("/sensors/status").json()
    assert dash["readings_received"] >= 1
    assert dash["last_sync"] is not None
