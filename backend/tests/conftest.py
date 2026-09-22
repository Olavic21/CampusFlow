import os

# Environnement — DOIT être configuré avant tout import applicatif
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SENSOR_MODE", "simulation")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only-32chars")

import pytest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fakeredis import FakeRedis

# Imports applicatifs après configuration de l'environnement
from app.main import app
from app.database.session import get_db
from app.database.models import Base
from app.utils.redis_client import redis_client

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db?check_same_thread=False"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Fixture DB
@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# Override de la dépendance get_db
@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# Mock Redis
@pytest.fixture(autouse=True, scope="function")
def mock_redis(monkeypatch):
    fake_redis = FakeRedis(decode_responses=True)
    monkeypatch.setattr("app.utils.redis_client.redis_client", fake_redis)
    return fake_redis


# ── Données de base ──────────────────────────────────────────────────────────
# Coordonnées posées SUR les allées du campus SUP'PTIC : le graphe piéton est
# câblé sur ces coordonnées — sans cela, aucun bâtiment ne serait connecté
# au graphe et /path renverrait systématiquement 409.
@pytest.fixture(scope="function")
def sample_locations(db_session):
    from app.database.models import Location

    locs = [
        Location(nom="Bat A", latitude=3.86855, longitude=11.50715, capacite=300, type="amphi"),
        Location(nom="Bat B", latitude=3.86975, longitude=11.50865, capacite=150, type="labo"),
        Location(nom="Bat C", latitude=3.87035, longitude=11.5097, capacite=50, type="admin"),
    ]
    for loc in locs:
        db_session.add(loc)
    db_session.commit()
    return db_session.query(Location).all()


@pytest.fixture(scope="function")
def sample_flux(db_session, sample_locations):
    """Lectures de flux récentes (fenêtre 5 min) pour chaque location."""
    from app.database.models import Flux
    from app.services.congestion_levels import (
        congestion_level_from_taux,
        db_value_for_level,
    )

    flux_list = []
    for i, loc in enumerate(sample_locations):
        for m in (0, 1):  # deux lectures dans la fenêtre
            ts = datetime.now(tz=timezone.utc) - timedelta(minutes=m)
            n = 30 + i * 5
            ratio = n / loc.capacite
            flux = Flux(
                location_id=loc.id,
                timestamp=ts,
                nombre_etudiants=n,
                activite_prevue=1,
                heure_du_jour=ts.hour,
                jour_semaine=min(ts.weekday(), 5),
                niveau_congestion=db_value_for_level(congestion_level_from_taux(ratio)),
            )
            db_session.add(flux)
            flux_list.append(flux)
    db_session.commit()
    return flux_list


@pytest.fixture(scope="function")
def sample_feedbacks(db_session):
    from app.database.models import Feedback

    sentiments = ["positive", "negative", "positive"]
    fb = [
        Feedback(
            etudiant_id=1000 + i,
            texte=f"Retour étudiant test #{i + 1}",
            sentiment=sentiments[i],
            timestamp=datetime.now(tz=timezone.utc),
        )
        for i in range(3)
    ]
    for f in fb:
        db_session.add(f)
    db_session.commit()
    return fb


# ── Authentification / RBAC ──────────────────────────────────────────────────
def _make_user(db_session, *, role, username):
    from app.database.models import User
    from app.utils.security import hash_password

    user = User(
        full_name=f"Test {username}",
        email=f"{username}@example.com",
        username=username,
        hashed_password=hash_password("password123"),
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _headers_for(user):
    from app.utils.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


@pytest.fixture(scope="function")
def admin_headers(client, db_session):
    return _headers_for(_make_user(db_session, role="admin", username="admin"))


@pytest.fixture(scope="function")
def staff_headers(client, db_session):
    return _headers_for(_make_user(db_session, role="staff", username="staff"))


@pytest.fixture(scope="function")
def student_headers(client, db_session):
    return _headers_for(_make_user(db_session, role="student", username="student"))