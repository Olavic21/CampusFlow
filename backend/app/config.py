import os
from pathlib import Path

from dotenv import load_dotenv

# backend/.env (quel que soit le répertoire de lancement)
_BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_DIR / ".env")

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    SQLALCHEMY_DATABASE_URL: str = os.getenv("SQLALCHEMY_DATABASE_URL")
    REDIS_URL: str = os.getenv("REDIS_URL")
    ML_MODEL_PATH: str = os.getenv("ML_MODEL_PATH")
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS").split(",")
        if o.strip()
    ]


settings = Settings()
