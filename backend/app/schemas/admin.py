from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AdminUserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    full_name: str
    email: str
    username: str
    role: str = "student"
    is_active: bool = True
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class AdminUserUpdate(BaseModel):
    role: Optional[str] = None        # student | staff | admin
    is_active: Optional[bool] = None