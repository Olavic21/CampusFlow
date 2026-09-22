"""Phase 3 — « Salle libre maintenant » + prévision 24 h (profil horaire)."""
from datetime import datetime, timedelta, timezone

from app.database.models import Flux, Location
from app.services.congestion_levels import congestion_level_from_taux, db_value_for_level


def _seed_with_flux(db_session):
    loc = Location(
        nom="Labo Libre",
        latitude=3.86935,
        longitude=11.5080,
        capacite=100,
        type="labo",
    )
    loc_busy = Location(
        nom="Amphi Plein",
        latitude=3.86955,
        longitude=11.50835,
        capacite=50,
        type="amphi",
    )
    db_session.add_all([loc, loc_busy])
    db_session.commit()

    now = datetime.now(tz=timezone.utc)
    # Salle quasi vide (10 %) vs salle saturée (92 %)
    for m in (0, 1):
        for target, n in ((loc, 10), (loc_busy, 46)):
            ts = now - timedelta(minutes=m)
            db_session.add(
                Flux(
                    location_id=target.id,
                    timestamp=ts,
                    nombre_etudiants=n,
                    activite_prevue=1,
                    heure_du_jour=ts.hour,
                    jour_semaine=min(ts.weekday(), 5),
                    niveau_congestion=db_value_for_level(congestion_level_from_taux(n / target.capacite)),
                )
            )
    db_session.commit()
    return loc, loc_busy


def test_free_locations_returns_only_quiet_rooms(client, db_session):
    loc, loc_busy = _seed_with_flux(db_session)
    data = client.get("/locations/free").json()
    ids = [d["id"] for d in data]
    assert loc.id in ids
    assert loc_busy.id not in ids
    entry = next(d for d in data if d["id"] == loc.id)
    assert entry["occupancy_rate"] <= 0.4
    assert entry["is_stale"] is False
    assert entry["count"] <= entry["capacite"] * 0.4


def test_free_locations_limit(client, db_session):
    _seed_with_flux(db_session)
    data = client.get("/locations/free?limit=1").json()
    assert len(data) <= 1


def test_forecast_24h(client, db_session, sample_locations, sample_flux):
    loc_id = sample_locations[0].id
    response = client.get(f"/predict/forecast/{loc_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["location_id"] == loc_id
    assert data["source"] == "PREDICTED"
    assert data["method"] == "profil_horaire_historique"
    assert 0 <= data["confidence"] <= 1
    assert len(data["points"]) == 24
    # Les heures avec données sont prédites avec bande min/max
    populated = [p for p in data["points"] if p["predicted"] is not None]
    assert populated, "les fixtures fournissent des flux récents"
    for p in populated:
        assert p["min"] <= p["predicted"] <= p["max"] + 0.001


def test_forecast_unknown_location_404(client):
    assert client.get("/predict/forecast/9999").status_code == 404