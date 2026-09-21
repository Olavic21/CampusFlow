"""RBAC — rôle utilisateur + protection de l'injection capteurs (P0-1)."""
from app.database.models import Location, Sensor
from app.sensors.services.ingest import ensure_sensors_seeded


def _seed_location(db_session):
    loc = Location(
        nom="Amphi RBAC",
        latitude=3.86935,
        longitude=11.5080,
        capacite=100,
        type="amphi",
    )
    db_session.add(loc)
    db_session.commit()
    db_session.refresh(loc)
    return loc


def _seed_sensor(db_session, loc):
    db_session.add(
        Sensor(
            name="RBAC-001",
            location_id=loc.id,
            building=loc.nom,
            sensor_type="counter",
            status="online",
            source="simulation",
        )
    )
    db_session.commit()


def test_inject_unauthenticated_401(client, db_session):
    loc = _seed_location(db_session)
    _seed_sensor(db_session, loc)
    response = client.post(
        "/sensors/test-data", json={"building_id": loc.id, "occupancy": 5}
    )
    assert response.status_code == 401


def test_inject_student_403(client, db_session, student_headers):
    loc = _seed_location(db_session)
    _seed_sensor(db_session, loc)
    response = client.post(
        "/sensors/test-data",
        json={"building_id": loc.id, "occupancy": 5},
        headers=student_headers,
    )
    assert response.status_code == 403


def test_inject_staff_ok(client, db_session, staff_headers):
    loc = _seed_location(db_session)
    _seed_sensor(db_session, loc)
    response = client.post(
        "/sensors/test-data",
        json={"building_id": loc.id, "occupancy": 7},
        headers=staff_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["reading"]["occupancy"] == 7


def test_inject_admin_ok(client, db_session, admin_headers):
    loc = _seed_location(db_session)
    _seed_sensor(db_session, loc)
    response = client.post(
        "/sensors/test-data",
        json={"building_id": loc.id, "occupancy": 9},
        headers=admin_headers,
    )
    assert response.status_code == 200


def test_user_out_exposes_role(client, db_session, student_headers):
    response = client.get("/auth/me", headers=student_headers)
    assert response.status_code == 200
    assert response.json()["role"] == "student"


def test_register_defaults_to_student(client):
    response = client.post(
        "/auth/register",
        json={
            "full_name": "Nouveau Etudiant",
            "email": "newetu@example.com",
            "username": "newetu",
            "password": "password123",
            "password_confirm": "password123",
        },
    )
    assert response.status_code == 201
    assert response.json()["user"]["role"] == "student"


def test_heartbeat_offline(client, db_session):
    """P0 : un capteur muet depuis > seuil apparaît offline (statut effectif)."""
    from datetime import datetime, timedelta, timezone

    from app.utils.redis_client import redis_client  # noqa: F401 — mock actif
    from app.utils import security  # noqa: F401

    loc = _seed_location(db_session)
    _seed_sensor(db_session, loc)
    # Backdater last_seen au-delà du seuil heartbeat
    sensor = db_session.query(Sensor).filter(Sensor.name == "RBAC-001").first()
    sensor.last_seen = datetime.now(tz=timezone.utc) - timedelta(hours=2)
    db_session.commit()

    response = client.get("/sensors")
    assert response.status_code == 200
    data = response.json()
    target = next(s for s in data if s["name"] == "RBAC-001")
    assert target["status"] == "offline"