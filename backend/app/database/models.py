from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, SmallInteger, Numeric, JSON, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    avatar = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    preferences = relationship("UserPreference", back_populates="user", uselist=False)
    favorite_locations = relationship("FavoriteLocation", back_populates="user")
    favorite_routes = relationship("FavoriteRoute", back_populates="user")
    route_history = relationship("RouteHistory", back_populates="user")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    theme = Column(String(20), default="system")
    navigation_mode = Column(String(20), default="single")
    extra = Column(JSON, nullable=True)

    user = relationship("User", back_populates="preferences")


class FavoriteLocation(Base):
    __tablename__ = "favorite_locations"
    __table_args__ = (UniqueConstraint("user_id", "location_id", name="uq_fav_loc"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    label = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="favorite_locations")


class FavoriteRoute(Base):
    __tablename__ = "favorite_routes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    start_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    end_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    label = Column(String(255), nullable=True)
    distance_m = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="favorite_routes")


class RouteHistory(Base):
    __tablename__ = "route_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    start_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    end_location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    distance_m = Column(Integer, nullable=False)
    duration_min = Column(Integer, nullable=True)
    path_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", back_populates="route_history")


class Location(Base):
    """
    Miroir exact de data/db/schema.sql — table locations.
    PostGIS (geom) est ignoré côté ORM ; on travaille avec lat/lon.
    """
    __tablename__ = "locations"

    id          = Column(Integer, primary_key=True, index=True)
    nom         = Column(String(255), nullable=False)
    latitude    = Column(Numeric(9, 6), nullable=False)
    longitude   = Column(Numeric(9, 6), nullable=False)
    capacite    = Column(Integer, nullable=False)
    type        = Column(String(100), nullable=False)
    # geom ignoré par l'ORM (géré par PostGIS uniquement)


class Schedule(Base):
    """
    Miroir de data/db/schema.sql — table schedules.
    Aligné sur raw/schedules.csv (groupe, type_activite, jour_semaine).
    """
    __tablename__ = "schedules"

    id             = Column(Integer, primary_key=True, index=True)
    groupe         = Column(String(20), nullable=False)
    type_activite  = Column(String(10), nullable=False)          # 'cours' | 'tp'
    salle_id       = Column(Integer, ForeignKey("locations.id"), nullable=False)
    heure_debut    = Column(DateTime(timezone=True), nullable=False)
    heure_fin      = Column(DateTime(timezone=True), nullable=False)
    jour_semaine   = Column(SmallInteger, nullable=False)        # 0=Lun … 5=Sam


class Flux(Base):
    """
    Miroir de data/db/schema.sql — table flux.
    Colonnes alignées sur les features attendues par ml/model.pkl.
    """
    __tablename__ = "flux"

    id                   = Column(Integer, primary_key=True, index=True)
    location_id          = Column(Integer, ForeignKey("locations.id"), nullable=False)
    timestamp            = Column(DateTime(timezone=True), nullable=False, index=True)
    nombre_etudiants     = Column(Integer, nullable=False)
    activite_prevue      = Column(Integer, nullable=False)       # 1 ou 0
    heure_du_jour        = Column(Integer, nullable=False)       # 0-23
    jour_semaine         = Column(Integer, nullable=False)       # 0=Lun … 5=Sam
    niveau_congestion    = Column(String(50), nullable=False)    # faible/moyen/élevé


class Sensor(Base):
    """Capteur IoT rattaché à une salle / bâtiment."""
    __tablename__ = "sensors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    building = Column(String(255), nullable=False)
    sensor_type = Column(String(50), nullable=False, default="counter")
    status = Column(String(20), nullable=False, default="online")
    source = Column(String(50), nullable=False, default="simulation")
    last_seen = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    location = relationship("Location", backref="sensors")
    readings = relationship("SensorReading", back_populates="sensor")


class SensorReading(Base):
    """Lecture temps réel d'un capteur."""
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    occupancy = Column(Integer, nullable=False)
    confidence_score = Column(Float, nullable=False, default=1.0)
    source = Column(String(50), nullable=False, default="simulation")

    sensor = relationship("Sensor", back_populates="readings")


class Feedback(Base):
    """
    Miroir de data/db/schema.sql — table feedbacks.
    """
    __tablename__ = "feedbacks"

    id           = Column(Integer, primary_key=True, index=True)
    etudiant_id  = Column(Integer, nullable=False)
    texte        = Column(Text, nullable=False)
    sentiment    = Column(String(50), nullable=False)
    timestamp    = Column(DateTime(timezone=True), nullable=False, index=True)
