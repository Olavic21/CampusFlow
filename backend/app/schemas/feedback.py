from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class FeedbackOut(BaseModel):
    id: int
    etudiant_id: int
    texte: str
    sentiment: str
    timestamp: datetime

    class Config:
        from_attributes = True


class FeedbackListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[FeedbackOut]
