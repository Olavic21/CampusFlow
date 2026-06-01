from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, SmallInteger
from app.database.session import Base
from sqlalchemy.sql import func

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    type = Column(String(50), nullable=False)
    capacity = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Flux(Base):
    __tablename__ = "flux"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    entries = Column(Integer, nullable=False)
    exits = Column(Integer, nullable=False)
    count = Column(Integer, nullable=False)  # occupation instantanée
    source = Column(String(20), default="sensor")

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    event_name = Column(String(200), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    event_type = Column(String(50), nullable=True)  # cours, examen, conférence

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    content = Column(Text, nullable=False)
    rating = Column(SmallInteger, nullable=False)  # 1..5
    sentiment = Column(String(10), nullable=False)  # positive/negative/neutral
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    student_hash = Column(String(64), nullable=True)