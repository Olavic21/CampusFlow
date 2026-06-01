import os
# Initialize environment variables needed for application configuration during tests
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fakeredis import FakeRedis

# Application imports are sensitive to environment variables and must happen after setup
from app.main import app
from app.database.session import get_db
from app.database.models import Base
from app.utils.redis_client import redis_client

# Base de données de test en mémoire
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db?check_same_thread=False"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Register date_trunc for SQLite
def _sqlite_date_trunc(part, date_str):
    # This is a simplified implementation for testing purposes
    # In a real scenario, you might need a more robust solution
    # or use a different test database.
    # SQLite stores datetime as strings, so we parse and format
    dt = datetime.fromisoformat(date_str.replace('Z', '+00:00')) # Handle 'Z' for UTC
    if part == 'hour':
        return dt.replace(minute=0, second=0, microsecond=0).isoformat()
    elif part == 'day':
        return dt.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    # Add other granularities as needed
    return date_str

# Fixture pour la DB
@pytest.fixture(scope="function")
def db_session():
    # Création des tables
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    session.connection().connection.create_function("date_trunc", 2, _sqlite_date_trunc) # Register for this connection
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
    # Patch the singleton source so that all modules (including tests) use the mock
    monkeypatch.setattr("app.utils.redis_client.redis_client", fake_redis)
    return fake_redis

# Fixture de données de base
@pytest.fixture(scope="function")
def sample_locations(db_session):
    from app.database.models import Location
    locs = [
        Location(name="Bat A", latitude=48.8566, longitude=2.3522, type="amphi", capacity=300, is_active=True),
        Location(name="Bat B", latitude=48.8570, longitude=2.3530, type="labo", capacity=150, is_active=True),
        Location(name="Bat C", latitude=48.8560, longitude=2.3515, type="admin", capacity=50, is_active=False),
    ]
    for loc in locs:
        db_session.add(loc)
    db_session.commit()
    return db_session.query(Location).all()

@pytest.fixture(scope="function")
def sample_flux(db_session, sample_locations):
    from app.database.models import Flux
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    flux_list = []
    for i, loc in enumerate(sample_locations):
        if not loc.is_active:
            continue
        for m in range(0, 1):  # Use 'now' to fall within the strict 1-minute congestion window
            ts = now + timedelta(minutes=m)
            flux = Flux(
                location_id=loc.id,
                timestamp=ts,
                entries=30 + i*5,
                exits=20 + i*3,
                count=100 + i*10,
                source="sensor"
            )
            db_session.add(flux)
            flux_list.append(flux)
    db_session.commit()
    return flux_list

@pytest.fixture(scope="function")
def sample_feedbacks(db_session, sample_locations):
    from app.database.models import Feedback
    from datetime import datetime
    fb = []
    for loc in sample_locations[:2]:
        f = Feedback(
            location_id=loc.id,
            content="Test feedback",
            rating=4,
            sentiment="positive",
            created_at=datetime.utcnow(),
            student_hash="hash123"
        )
        db_session.add(f)
        fb.append(f)
    db_session.commit()
    return fb