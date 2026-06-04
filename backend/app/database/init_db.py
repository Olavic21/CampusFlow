"""
init_db.py — Création des tables via SQLAlchemy (dev/test).

En production, les tables sont créées par data/db/schema.sql (PostgreSQL + PostGIS).
Ce fichier sert uniquement à bootstrapper rapidement un environnement de dev
ou à faire tourner les tests avec SQLite.
"""
from app.database.session import engine, Base
import app.database.models  # noqa: F401 — User, Location, etc.


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Tables créées.")
