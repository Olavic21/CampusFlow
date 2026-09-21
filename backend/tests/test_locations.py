def test_get_locations(client, sample_locations):
    response = client.get("/locations")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Toutes les locations sont retournées (pas de colonne is_active)
    assert len(data) == 3
    assert data[0]["nom"] == "Bat A"


def test_get_locations_with_type_filter(client, sample_locations):
    response = client.get("/locations?type=amphi")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["type"] == "amphi"


def test_get_locations_unknown_type(client, sample_locations):
    response = client.get("/locations?type=inexistant")
    assert response.status_code == 200
    assert response.json() == []
