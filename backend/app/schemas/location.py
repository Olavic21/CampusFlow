from pydantic import BaseModel
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
