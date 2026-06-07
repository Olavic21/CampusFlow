from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sensors import (
    SensorDashboardOut,
    SensorModeOut,
    SensorOut,
    SensorTestDataIn,
)
from app.sensors.services.sensor_data_provider import SensorDataProvider
from app.sensors.websocket.hub import occupancy_hub

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
    return _provider.list_sensors(db)


@router.post("/test-data")
async def inject_test_data(body: SensorTestDataIn, db: Session = Depends(get_db)):
    """Injecte une lecture simulée (tests ESP32, API, démo)."""
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
