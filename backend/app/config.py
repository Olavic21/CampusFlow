import os
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
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
        if o.strip()
    ]
    ML_MODEL_PATH: str = os.getenv("ML_MODEL_PATH", "../ml/model.pkl")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-campusflow-dev-secret-key-32chars")
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_MINUTES: int = int(os.getenv("JWT_ACCESS_MINUTES", "60"))
    JWT_REFRESH_DAYS: int = int(os.getenv("JWT_REFRESH_DAYS", "30"))
    BCRYPT_ROUNDS: int = int(os.getenv("BCRYPT_ROUNDS", "10"))

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


settings = Settings()
