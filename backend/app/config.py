import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    SQLALCHEMY_DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./campusflow.db",  # dev local sans PostgreSQL
    )
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    # CORS_ORIGINS : liste séparée par virgules dans .env
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
        if o.strip()
    ]
    # Chemin vers ml/model.pkl (relatif au répertoire racine du projet)
    ML_MODEL_PATH: str = os.getenv("ML_MODEL_PATH", "../ml/model.pkl")


settings = Settings()
