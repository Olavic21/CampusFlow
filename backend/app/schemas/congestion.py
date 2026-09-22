from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class CongestionLevel(str, Enum):
    low      = "low"
    medium   = "medium"
    high     = "high"
    critical = "critical"


class CongestionResponse(BaseModel):
    location_id:    int
    level:          CongestionLevel
    occupancy_rate: float       # 0.0 → 1.0
    current_count:  int         # nombre_etudiants moyen sur la fenêtre
    updated_at:     str         # ISO 8601
