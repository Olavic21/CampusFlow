from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class IncidentCreate(BaseModel):
    location_id: int
    type: str = Field("closure", description="closure | works | event")
    severity: str = Field("high", description="low | medium | high")
    message: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class IncidentUpdate(BaseModel):
    message: Optional[str] = None
    severity: Optional[str] = None
    active: Optional[bool] = None
    ends_at: Optional[datetime] = None


class IncidentOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    location_id: int
    type: str
    severity: str
    message: Optional[str] = None
    active: bool
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    location_nom: Optional[str] = None