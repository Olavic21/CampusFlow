from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.models import Incident, Location, User
from app.database.session import get_db
from app.schemas.incidents import IncidentCreate, IncidentOut, IncidentUpdate
from app.utils.security import require_role

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _to_out(inc: Incident) -> IncidentOut:
    out = IncidentOut.model_validate(inc)
    out.location_nom = inc.location.nom if inc.location else None
    return out


@router.get("", response_model=list[IncidentOut])
def list_incidents(
    active_only: bool = Query(True, description="Uniquement les incidents actifs"),
    location_id: int = Query(None, description="Filtrer par bâtiment"),
    db: Session = Depends(get_db),
):
    """Incidents signalés — lecture publique, gestion réservée au staff (P0 RBAC)."""
    q = db.query(Incident)
    if active_only:
        q = q.filter(Incident.active.is_(True))
    if location_id is not None:
        q = q.filter(Incident.location_id == location_id)
    rows = q.order_by(Incident.created_at.desc()).limit(100).all()
    return [_to_out(inc) for inc in rows]


@router.post("", response_model=IncidentOut, status_code=201)
def create_incident(
    body: IncidentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("staff")),
):
    if not db.query(Location).filter(Location.id == body.location_id).first():
        raise HTTPException(status_code=404, detail="Bâtiment inconnu")
    inc = Incident(
        location_id=body.location_id,
        type=body.type,
        severity=body.severity,
        message=body.message,
        starts_at=body.starts_at or datetime.now(tz=timezone.utc),
        ends_at=body.ends_at,
        created_by=user.id,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return _to_out(inc)


@router.patch("/{incident_id}", response_model=IncidentOut)
def update_incident(
    incident_id: int,
    body: IncidentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("staff")),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    if body.message is not None:
        inc.message = body.message
    if body.severity is not None:
        inc.severity = body.severity
    if body.active is not None:
        inc.active = body.active
    if body.ends_at is not None:
        inc.ends_at = body.ends_at
    db.commit()
    db.refresh(inc)
    return _to_out(inc)


@router.delete("/{incident_id}")
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    db.delete(inc)
    db.commit()
    return {"ok": True}