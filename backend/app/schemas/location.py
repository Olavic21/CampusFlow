from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LocationBase(BaseModel):
    name: str
    latitude: float
    longitude: float
    type: str
    capacity: int
    description: Optional[str] = None
    is_active: bool = True

class LocationOut(LocationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True