from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import Location, Sensor, SensorReading, User
from app.schemas.sensors import (
    SensorCreate,
    SensorDashboardOut,
    SensorModeOut,
    SensorOut,
    SensorTestDataIn,
    SensorUpdate,
)
from app.sensors.services.sensor_data_provider import (
    SensorDataProvider,
    effective_status,
)
from app.sensors.websocket.hub import occupancy_hub
from app.utils.security import require_role

router = APIRouter(prefix="/sensors", tags=["sensors"])

_provider = SensorDataProvider()


@router.get("/mode", response_model=SensorModeOut)
def get_sensor_mode():
    info = _provider.get_mode_info()
    return SensorModeOut(**info)


@router.get("/status", response_model=SensorDashboardOut)
def get_sensor_dashboard(db: Session = Depends(get_db)):
    return SensorDashboardOut(**_provider.get_dashboard(db))


@router.get("", response_model=list[SensorOut])
def list_sensors(db: Session = Depends(get_db)):
    sensors = _provider.list_sensors(db)
    out = []
    for s in sensors:
        item = SensorOut.model_validate(s)
        item.status = effective_status(s)  # heartbeat — capteur muet = offline
        out.append(item)
    return out


@router.post("/test-data")
async def inject_test_data(
    body: SensorTestDataIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("staff")),
):
    """Injecte une lecture simulée — réservé au staff/admin (anti-empoisonnement)."""
    try:
        payload = _provider.ingest_test_data(
            db,
            location_id=body.building_id,
            occupancy=body.occupancy,
            sensor_id=body.sensor_id,
            confidence_score=body.confidence_score,
            timestamp=body.timestamp,
        )
        db.commit()
        await occupancy_hub.broadcast(payload)
        return {"ok": True, "reading": payload}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Erreur lors de l'injection") from e


# ── CRUD capteurs (Phase 4) — création/édition staff, suppression admin ──────

@router.post("", response_model=SensorOut, status_code=201)
def create_sensor(
    body: SensorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("staff")),
):
    """Enregistre un capteur physique rattaché à un bâtiment."""
    loc = db.query(Location).filter(Location.id == body.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Bâtiment inconnu")
    if db.query(Sensor).filter(Sensor.name == body.name).first():
        raise HTTPException(status_code=400, detail="Nom de capteur déjà utilisé")
    sensor = Sensor(
        name=body.name,
        location_id=body.location_id,
        building=loc.nom,
        sensor_type=body.sensor_type,
        status="online",
        source=body.source or "api",
        last_seen=datetime.now(tz=timezone.utc) if body.mark_online else None,
    )
    db.add(sensor)
    db.commit()
    db.refresh(sensor)
    return SensorOut.model_validate(sensor)


@router.patch("/{sensor_id}", response_model=SensorOut)
def update_sensor(
    sensor_id: int,
    body: SensorUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("staff")),
):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Capteur introuvable")
    if body.name is not None and body.name != sensor.name:
        if db.query(Sensor).filter(Sensor.name == body.name).first():
            raise HTTPException(status_code=400, detail="Nom de capteur déjà utilisé")
        sensor.name = body.name
    if body.location_id is not None:
        loc = db.query(Location).filter(Location.id == body.location_id).first()
        if not loc:
            raise HTTPException(status_code=404, detail="Bâtiment inconnu")
        sensor.location_id = loc.id
        sensor.building = loc.nom
    if body.sensor_type is not None:
        sensor.sensor_type = body.sensor_type
    if body.status is not None:
        sensor.status = body.status
    db.commit()
    db.refresh(sensor)
    out = SensorOut.model_validate(sensor)
    out.status = effective_status(sensor)  # statut effectif (heartbeat)
    return out


@router.delete("/{sensor_id}")
def delete_sensor(
    sensor_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Supprime un capteur — ses lectures historiques sont conservées (orphelines)."""
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Capteur introuvable")
    db.query(SensorReading).filter(SensorReading.sensor_id == sensor_id).update(
        {"sensor_id": None}, synchronize_session=False
    )
    db.delete(sensor)
    db.commit()
    return {"ok": True}
