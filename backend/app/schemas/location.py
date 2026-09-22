from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class LocationBase(BaseModel):
    nom:       str
    latitude:  float
    longitude: float
    capacite:  int
    type:      str


class LocationOut(LocationBase):
    id: int

    class Config:
        from_attributes = True


class LocationFreeOut(BaseModel):
    """Bâtiment libre MAINTENANT — « salle libre » (Phase 3)."""

    id: int
    nom: str
    type: str
    capacite: int
    latitude: float
    longitude: float
    count: int
    occupancy_rate: float
    last_update: datetime
    is_stale: bool = False
