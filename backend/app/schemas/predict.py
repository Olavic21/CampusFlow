from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PredictRequest(BaseModel):
    location_id: int
    datetime: datetime
    # event_type supprimé : le modèle détermine activite_prevue depuis la table schedules


class PredictResponse(BaseModel):
    location_id: int
    predicted_level: str          # faible / moyen / eleve
    confidence: float
    predicted_occupancy_rate: float
    model_version: str
