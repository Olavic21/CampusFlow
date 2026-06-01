import joblib
import numpy as np
import os
from datetime import datetime
from app.config import settings
from app.database.models import Location
from sqlalchemy.orm import Session

model = None

def load_model():
    global model
    path = settings.ML_MODEL_PATH
    if model is None and os.path.exists(path):
        model = joblib.load(path)
    return model

def predict_congestion(db: Session, location_id: int, dt: datetime, event_type: str):
    model = load_model()
    if model is None:
        raise RuntimeError("ML model not loaded")
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise ValueError("Location not found")
    # Features: location_id, weekday, hour, event_type_onehot
    weekday = dt.weekday()  # 0=Monday
    hour = dt.hour
    # Événement codé
    event_code = 0
    if event_type:
        event_code = 1 if event_type == "cours" else 2
    X = np.array([[location_id, weekday, hour, event_code]])
    pred = model.predict(X)[0]  # prédire niveau (0=low,1=medium,2=high,3=critical)
    levels = ["low", "medium", "high", "critical"]
    predicted_level = levels[int(pred)]
    confidence = np.max(model.predict_proba(X)) if hasattr(model, "predict_proba") else 0.75
    occupancy_rate = (pred / 3) * 0.9 + 0.1  # simulé
    return {
        "location_id": location_id,
        "predicted_level": predicted_level,
        "confidence": round(confidence, 2),
        "predicted_occupancy_rate": round(occupancy_rate, 2),
        "model_version": "v2.1.0"
    }