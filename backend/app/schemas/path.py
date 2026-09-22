from pydantic import BaseModel
from typing import List

class Waypoint(BaseModel):
    lat: float
    lng: float

class PathResponse(BaseModel):
    path: List[int]
    total_distance: float  # meters
    estimated_time: int  # seconds
    waypoints: List[Waypoint]