from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Text, SmallInteger, Numeric
)
from sqlalchemy.sql import func
from app.database.session import Base


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
