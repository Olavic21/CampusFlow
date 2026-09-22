from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SensorOut(BaseModel):
    id: int
    name: str
    location_id: int
    building: str
    sensor_type: str
    status: str
    source: str
    last_seen: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SensorReadingOut(BaseModel):
    id: int
    sensor_id: int
    location_id: int
    timestamp: datetime
    occupancy: int
    confidence_score: float
    source: str

    model_config = {"from_attributes": True}


class SensorTestDataIn(BaseModel):
    building_id: int = Field(..., description="ID du bâtiment (location_id)")
    occupancy: int = Field(..., ge=0)
    sensor_id: Optional[int] = None
    timestamp: Optional[datetime] = None
    confidence_score: float = Field(1.0, ge=0.0, le=1.0)


class SensorCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Nom unique du capteur")
    location_id: int = Field(..., description="Bâtiment rattaché (location_id)")
    sensor_type: str = Field("counter", description="counter | camera | rfid | infrared")
    source: Optional[str] = Field("api", description="Source des lectures (api | mqtt)")
    mark_online: bool = Field(True, description="Poser last_seen au dépôt")


class SensorUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    location_id: Optional[int] = None
    sensor_type: Optional[str] = None
    status: Optional[str] = Field(None, description="online | offline | error | maintenance")


class SensorModeOut(BaseModel):
    mode: str
    is_real: bool
    label: str
    description: str


class SensorDashboardOut(BaseModel):
    mode: str
    is_real: bool
    label: str
    active_sensors: int
    total_sensors: int
    readings_received: int
    last_sync: Optional[datetime] = None


class LiveOccupancyMessage(BaseModel):
    building_id: int
    occupancy: int
    timestamp: str
    source: str
    confidence_score: float = 1.0
