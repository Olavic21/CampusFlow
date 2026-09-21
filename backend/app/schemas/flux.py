from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class FluxLiveResponse(BaseModel):
    location_id: int
    nombre_etudiants: int
    timestamp: datetime
    # Qualification de fraîcheur (data_quality) — honnêteté des données
    is_stale: bool = False
    source: Optional[str] = None
    confidence_score: Optional[float] = None


class FluxHistoryPoint(BaseModel):
    timestamp: str
    avg_students: int
    max_students: int
    min_students: int


class FluxHistoryResponse(BaseModel):
    location_id: int
    period: dict          # {from, to}
    granularity: str
    data: List[FluxHistoryPoint]
