import json
from app.utils.redis_client import redis_client

def test_get_congestion_no_cache(client, db_session, sample_locations, sample_flux):
    # Pas de cache initial
    response = client.get("/congestion")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3  # un niveau par bâtiment avec du flux récent
    assert "level" in data[0]
    assert 0 <= data[0]["occupancy_rate"] <= 1

def test_get_congestion_with_cache(client, db_session, sample_locations, sample_flux):
    # Pré-remplir Redis
    fake_data = {
        "location_id": sample_locations[0].id,
        "level": "low",
        "occupancy_rate": 0.2,
        "current_count": 30,
        "updated_at": "2025-01-01T00:00:00"
    }
    redis_client.setex(f"congestion:{sample_locations[0].id}", 60, json.dumps(fake_data))
    response = client.get(f"/congestion?location_id={sample_locations[0].id}")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["level"] == "low"
    assert data[0]["current_count"] == 30

def test_get_congestion_location_not_found(client):
    response = client.get("/congestion?location_id=999")
    assert response.status_code == 404