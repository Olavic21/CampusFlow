import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/mydatabase")
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0") 
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    ML_MODEL_PATH = os.getenv("ML_MODEL_PATH", "../ml/model.pkl")

settings = Settings()