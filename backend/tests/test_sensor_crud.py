"""Phase 4 — CRUD capteurs (staff/admin) + heartbeat déjà testé (test_rbac)."""
from app.database.models import Location, Sensor
from app.sensors.services.ingest import ensure_sensors_seeded


def _seed_location(db_session):
    loc = Location(
        nom="Amphi CRUD",
        latitude=3.86935,
        longitude=11.5080,
        capacite=80,
        type="amphi",
    )
    db_session.add(loc)
    db_session.commit()
    db_session.refresh(loc)
    return loc


def test_create_sensor_requires_auth(client, db_session):
    loc = _seed_location(db_session)
    response = client.post(
        "/sensors",
        json={"name": "ESP-01", "location_id": loc.id},
    )
    assert response.status_code == 401


def test_create_and_update_sensor_staff(client, db_session, staff_headers):
    loc = _seed_location(db_session)

    created = client.post(
        "/sensors",
        json={"name": "ESP-CRUD-01", "location_id": loc.id, "sensor_type": "camera"},
        headers=staff_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "ESP-CRUD-01"
    assert body["building"] == loc.nom
    sensor_id = body["id"]

    updated = client.patch(
        f"/sensors/{sensor_id}",
        json={"status": "maintenance"},
        headers=staff_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "maintenance"


def test_create_sensor_duplicate_name_400(client, db_session, staff_headers):
    loc = _seed_location(db_session)
    payload = {"name": "ESP-DUP", "location_id": loc.id}
    assert client.post("/sensors", json=payload, headers=staff_headers).status_code == 201
    assert client.post("/sensors", json=payload, headers=staff_headers).status_code == 400


def test_delete_sensor_admin_only(client, db_session, staff_headers, admin_headers):
    loc = _seed_location(db_session)
    ensure_sensors_seeded(db_session)
    sensor = db_session.query(Sensor).filter(Sensor.location_id == loc.id).first()

    assert (
        client.delete(f"/sensors/{sensor.id}", headers=staff_headers).status_code == 403
    )
    deleted = client.delete(f"/sensors/{sensor.id}", headers=admin_headers)
    assert deleted.status_code == 200
    assert deleted.json()["ok"] is True
    assert db_session.query(Sensor).filter(Sensor.id == sensor.id).first() is None