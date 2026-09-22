from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProfileOut(BaseModel):
    id: int
    full_name: str
    email: str
    username: str
    avatar: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}
