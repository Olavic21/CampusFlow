"""
init_db.py — Création des tables + migrations légères idempotentes (dev/test).

En production, les tables sont créées par data/db/schema.sql (PostgreSQL + PostGIS)
puis complétées par les mêmes migrations légères (colonnes manquantes, index).
Ce fichier sert à bootstrapper rapidement un environnement de dev ou les tests.
"""
import logging

from sqlalchemy import inspect, text

from app.database.session import engine, Base
import app.database.models  # noqa: F401 — User, Location, etc.

logger = logging.getLogger("campusflow.db")


def _table_exists(conn, table: str) -> bool:
    return conn.dialect.has_table(conn, table)


def _ensure_column(bind, table: str, column: str, ddl: str) -> None:
    """Ajoute une colonne si absente (SQLite/PostgreSQL compatibles)."""
    insp = inspect(bind)
    if table not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns(table)]
    if column in cols:
        return
    try:
        bind.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))
        logger.info("Migration : colonne %s.%s ajoutée", table, column)
    except Exception as e:  # pragma: no cover — environnement déjà à jour
        logger.warning("Migration %s.%s ignorée : %s", table, column, e)


def _ensure_unique_favorite_routes(bind) -> None:
    """Dédupe puis pose l'index unique sur favorite_routes (user, start, end)."""
    try:
        bind.execute(
            text(
                """
                DELETE FROM favorite_routes
                WHERE id NOT IN (
                    SELECT MIN(id) FROM favorite_routes
                    GROUP BY user_id, start_location_id, end_location_id
                )
                """
            )
        )
        bind.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_fav_route
                ON favorite_routes (user_id, start_location_id, end_location_id)
                """
            )
        )
    except Exception as e:  # pragma: no cover
        logger.warning("Index unique favorite_routes ignoré : %s", e)


def run_lightweight_migrations() -> None:
    """Migrations idempotentes exécutées à chaque démarrage."""
    with engine.connect() as conn:
        # RBAC : rôle utilisateur (student | staff | admin)
        _ensure_column(
            conn, "users", "role", "role VARCHAR(20) NOT NULL DEFAULT 'student'"
        )
        if _table_exists(conn, "favorite_routes"):
            _ensure_unique_favorite_routes(conn)
        conn.commit()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    run_lightweight_migrations()


if __name__ == "__main__":
    init_db()
    print("Tables créées + migrations appliquées.")
