import os
import secrets
import warnings
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_PROJECT_ROOT = _BACKEND_DIR.parent


class Settings:
    SQLALCHEMY_DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./campusflow.db",
    )
    # SQLite : chemin absolu + création du dossier parent si nécessaire
    # (ex. /opt/render/project/src/data sur Render, /data avec un Disk Render).
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        from sqlalchemy.engine import make_url
        _db = make_url(SQLALCHEMY_DATABASE_URL).database
        if _db and _db != ":memory:":
            _db_path = Path(_db)
            if not _db_path.is_absolute():
                # Relatif au dossier backend/ (indépendant du CWD) —
                # obligatoire pour Render avec Root Directory = backend.
                _db_path = (_BACKEND_DIR / _db_path).resolve()
            _db_path.parent.mkdir(parents=True, exist_ok=True)
            SQLALCHEMY_DATABASE_URL = f"sqlite:///{_db_path.as_posix()}"
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    _DEFAULT_CORS = (
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,"
        "https://localhost,capacitor://localhost,http://localhost"
    )
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", _DEFAULT_CORS).split(",")
        if o.strip()
    ]
    # Regex optionnelle (ex. previews Vercel : https://.*\.vercel\.app).
    # Vide par défaut : seules les origines explicites ci-dessus sont acceptées.
    CORS_ORIGIN_REGEX: str = os.getenv("CORS_ORIGIN_REGEX", "").strip()
    ML_MODEL_PATH: str = os.getenv("ML_MODEL_PATH", "../ml/model.pkl")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-campusflow-dev-secret-key-32chars")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_MINUTES: int = int(os.getenv("JWT_ACCESS_MINUTES", "60"))
    JWT_REFRESH_DAYS: int = int(os.getenv("JWT_REFRESH_DAYS", "30"))
    BCRYPT_ROUNDS: int = int(os.getenv("BCRYPT_ROUNDS", "10"))

    # Modèle ML — toujours résolu par rapport au dossier backend/ (pas au CWD)
    _ml_env = os.getenv("ML_MODEL_PATH", str(_PROJECT_ROOT / "ml" / "model.pkl"))
    _ml_path = Path(_ml_env)
    if not _ml_path.is_absolute():
        _ml_path = (_BACKEND_DIR / _ml_path).resolve()
    ML_MODEL_PATH: str = str(_ml_path)

    # Médias (équivalent Django MEDIA_ROOT / MEDIA_URL)
    MEDIA_ROOT: Path = Path(
        os.getenv("MEDIA_ROOT", str(_PROJECT_ROOT / "media"))
    ).resolve()
    MEDIA_URL: str = os.getenv("MEDIA_URL", "/media")
    AVATAR_UPLOAD_DIR: str = "avatars"
    AVATAR_MAX_UPLOAD_BYTES: int = int(os.getenv("AVATAR_MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
    AVATAR_MAX_DIMENSION: int = 512
    AVATAR_TARGET_MAX_BYTES: int = 500 * 1024
    PUBLIC_API_BASE: str = os.getenv("PUBLIC_API_BASE", "http://127.0.0.1:8000")

    # IoT / Capteurs — modes : simulation | api | mqtt | websocket | hybrid
    SENSOR_MODE: str = os.getenv("SENSOR_MODE", "simulation").strip().lower()
    SENSOR_SIM_INTERVAL_SEC: int = int(os.getenv("SENSOR_SIM_INTERVAL_SEC", "10"))
    CAPTEURS_JSON_PATH: Path = Path(
        os.getenv("CAPTEURS_JSON_PATH", str(_PROJECT_ROOT / "data" / "raw" / "capteurs.json"))
    ).resolve()
    MQTT_BROKER_URL: str = os.getenv("MQTT_BROKER_URL", "")
    MQTT_TOPIC: str = os.getenv("MQTT_TOPIC", "campusflow/occupancy/#")

    # Qualité des données — une lecture plus vieille que ce seuil est marquée STALE
    STALE_AFTER_SEC: int = int(os.getenv("STALE_AFTER_SEC", "120"))
    # Heartbeat capteur — au-delà de ce délai sans lecture, le capteur est "offline"
    SENSOR_HEARTBEAT_OFFLINE_SEC: int = int(os.getenv("SENSOR_HEARTBEAT_OFFLINE_SEC", "90"))
    # Rétention des séries temporelles (flux + sensor_readings), en jours
    RETENTION_DAYS: int = int(os.getenv("RETENTION_DAYS", "90"))


settings = Settings()
