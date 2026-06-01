from pydantic import BaseModel
from typing import List, Dict


class TopLocation(BaseModel):
    id:             int
    name:           str
    avg_congestion: float


class PeakHour(BaseModel):
    hour:         int
    avg_students: int


class DayStats(BaseModel):
    day:          str   # Lundi … Samedi
    avg_students: int


class DashboardStats(BaseModel):
    top_locations:         List[TopLocation]
    peak_hours:            List[PeakHour]
    avg_congestion_by_day: List[DayStats]
    feedback_summary:      Dict[str, int]    # {positive, negative, neutral}
    total_flux:            int
