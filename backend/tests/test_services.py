"""Tests des services métier — conformes aux modèles réels (Phase 0)."""
from app.services.location_service import get_all_locations
from app.services.congestion_service import get_congestion
from app.services.path_service import find_path
from app.services.flux_service import get_live_flux


def test_get_all_locations(db_session, sample_locations):
    locs = get_all_locations(db_session)
    assert len(locs) == 3
    locs_typed = get_all_locations(db_session, type_filter="amphi")
    assert len(locs_typed) == 1


def test_get_congestion_service(db_session, sample_locations, sample_flux):
    cong = get_congestion(db_session)
    assert len(cong) == 3
    for c in cong:
        assert "level" in c
        assert 0 <= c["occupancy_rate"] <= 1


def test_find_path_service(db_session, sample_locations):
    from_id = sample_locations[0].id
    to_id = sample_locations[1].id
    path_data = find_path(
        db_session, from_id, to_id, avoid_congestion=False, get_congestion=None
    )
    assert path_data is not None
    assert path_data["path"][0] == from_id
    assert path_data["path"][-1] == to_id
    assert path_data["total_distance"] > 0


def test_find_path_penalizes_congestion(db_session, sample_locations, sample_flux):
    """La pénalité congestion s'applique sans bloquer le calcul (P0)."""

    def fake_congestion(_db, _loc=None):
        return [{"location_id": sample_locations[1].id, "level": "critical"}]

    path_data = find_path(
        db_session,
        sample_locations[0].id,
        sample_locations[1].id,
        avoid_congestion=True,
        get_congestion=fake_congestion,
    )
    assert path_data is not None
    assert path_data["total_distance"] > 0


def test_live_flux_service(db_session, sample_flux):
    flux = get_live_flux(db_session, window_minutes=60)
    assert len(flux) >= 1
    for f in flux:
        assert "nombre_etudiants" in f


def test_readings_survive_restart(db_session, sample_locations):
    """P0-6 : compteurs dashboard avec fallback DB (le process redémarre)."""
    from datetime import datetime

    from app.database.models import SensorReading
    from app.sensors.services.ingest import (
        ingest_sensor_reading,
        get_readings_count_or_db,
        get_last_sync_or_db,
    )

    loc = sample_locations[0]
    ingest_sensor_reading(
        db_session, location_id=loc.id, occupancy=12, source="simulation"
    )
    db_session.commit()

    # Simulation d'un restart : les compteurs en mémoire sont réinitialisés
    import app.sensors.services.ingest as ingest_mod

    ingest_mod._readings_count = 0
    ingest_mod._last_sync = None

    assert get_readings_count_or_db(db_session) >= 1
    assert get_last_sync_or_db(db_session) is not None
    assert isinstance(get_last_sync_or_db(db_session), datetime)