from datetime import datetime, timezone


def _payload(loc_id):
    return {"location_id": loc_id, "datetime": datetime.now(tz=timezone.utc).isoformat()}


def test_predict_endpoint(client, sample_locations, monkeypatch):
    # Simuler le modèle chargé (le modèle réel est en LFS, absent en CI)
    from app.services import predict_service

    class MockModel:
        def predict(self, X):
            return [2]  # index → "eleve" (label_reverse par défaut)
        def predict_proba(self, X):
            return [[0.1, 0.2, 0.6, 0.1]]

    monkeypatch.setattr(predict_service, "_load_model", lambda: {"model": MockModel()})
    response = client.post("/predict", json=_payload(sample_locations[0].id))
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_level"] == "eleve"
    assert 0 <= data["confidence"] <= 1
    assert "model_version" in data

def test_predict_location_not_found(client, sample_locations, monkeypatch):
    """La salle inconnue renvoie 404 (le modèle est mocké : LFS absent en CI)."""
    from app.services import predict_service

    class MockModel:
        def predict(self, X):
            return [0]

    monkeypatch.setattr(predict_service, "_load_model", lambda: {"model": MockModel()})
    response = client.post("/predict", json=_payload(999))
    assert response.status_code == 404