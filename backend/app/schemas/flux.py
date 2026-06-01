from pydantic import BaseModel
from datetime import datetime
from typing import List


class FluxLiveResponse(BaseModel):
    location_id: int
    nombre_etudiants: int
    timestamp: datetime


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
