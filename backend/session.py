from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

_connect_args = {}
if settings.SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
    # Timeout d'attente si la base est verrouillée (évite les requêtes auth bloquées)
    _connect_args["timeout"] = 15

engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_connection, _connection_record):
    if not settings.SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=15000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()