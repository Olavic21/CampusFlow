def test_live_flux(client, sample_flux):
    response = client.get("/flux/live?window=5")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Un flux par bâtiment avec une lecture récente
    assert len(data) >= 1
    assert "nombre_etudiants" in data[0]
    assert "timestamp" in data[0]

def test_live_flux_qualifies_freshness(client, sample_flux):
    """P0-4 : /flux/live qualifie la fraîcheur (is_stale)."""
    response = client.get("/flux/live?window=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "is_stale" in data[0]
    assert data[0]["is_stale"] is False  # fixture posée à l'instant

def test_flux_history(client, sample_locations, sample_flux):
    loc_id = sample_locations[0].id
    response = client.get(f"/flux/history/{loc_id}?granularity=hour")
    assert response.status_code == 200
    data = response.json()
    assert data["location_id"] == loc_id
    assert "data" in data
    assert isinstance(data["data"], list)