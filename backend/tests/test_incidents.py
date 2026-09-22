"""Phase 2 — Incidents : CRUD RBAC + lecture publique."""

SAMPLE_LOCATIONS = [(3.86905, 11.50755), (3.86955, 11.50835)]


def test_list_incidents_empty(client):
    response = client.get("/incidents")
    assert response.status_code == 200
    assert response.json() == []


def test_create_incident_requires_auth(client, db_session, sample_locations):
    loc = sample_locations[0]
    response = client.post(
        "/incidents",
        json={"location_id": loc.id, "type": "closure", "message": "Fermé pour travaux"},
    )
    assert response.status_code == 401


def test_create_incident_student_403(client, db_session, sample_locations, student_headers):
    loc = sample_locations[0]
    response = client.post(
        "/incidents",
        json={"location_id": loc.id, "type": "closure"},
        headers=student_headers,
    )
    assert response.status_code == 403


def test_incident_lifecycle(client, db_session, sample_locations, staff_headers, admin_headers):
    loc = sample_locations[0]

    # Création (staff)
    response = client.post(
        "/incidents",
        json={"location_id": loc.id, "type": "works", "severity": "medium", "message": "Travaux allée nord"},
        headers=staff_headers,
    )
    assert response.status_code == 201
    incident = response.json()
    assert incident["active"] is True
    assert incident["location_nom"] == loc.nom
    incident_id = incident["id"]

    # Lecture publique (actifs uniquement)
    listed = client.get("/incidents").json()
    assert any(i["id"] == incident_id for i in listed)

    # Clôture (staff)
    closed = client.patch(f"/incidents/{incident_id}", json={"active": False}, headers=staff_headers)
    assert closed.status_code == 200
    assert closed.json()["active"] is False

    # N'apparaît plus dans les actifs
    assert all(i["id"] != incident_id for i in client.get("/incidents").json())
    # … mais reste dans l'historique
    assert any(
        i["id"] == incident_id for i in client.get("/incidents?active_only=false").json()
    )

    # Suppression (admin uniquement)
    assert (
        client.delete(f"/incidents/{incident_id}", headers=staff_headers).status_code == 403
    )
    assert (
        client.delete(f"/incidents/{incident_id}", headers=admin_headers).status_code == 200
    )


def test_create_incident_unknown_location_404(client, staff_headers):
    response = client.post(
        "/incidents",
        json={"location_id": 9999, "type": "closure"},
        headers=staff_headers,
    )
    assert response.status_code == 404