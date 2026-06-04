import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.database.models import User, FavoriteLocation, FavoriteRoute, RouteHistory, Location
from app.schemas.auth import FavoriteLocationCreate, FavoriteRouteCreate, RouteHistoryCreate
from app.utils.security import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class FavoriteLocationOut(BaseModel):
    id: int
    location_id: int
    label: Optional[str] = None
    location_name: Optional[str] = None

    model_config = {"from_attributes": True}


class FavoriteRouteOut(BaseModel):
    id: int
    start_location_id: int
    end_location_id: int
    label: Optional[str] = None
    distance_m: Optional[int] = None
    start_name: Optional[str] = None
    end_name: Optional[str] = None

    model_config = {"from_attributes": True}


class RouteHistoryOut(BaseModel):
    id: int
    start_location_id: int
    end_location_id: int
    distance_m: int
    duration_min: Optional[int] = None
    created_at: str
    start_name: Optional[str] = None
    end_name: Optional[str] = None

    model_config = {"from_attributes": True}


def _loc_name(db: Session, loc_id: int) -> Optional[str]:
    loc = db.query(Location).filter(Location.id == loc_id).first()
    return loc.nom if loc else None


@router.get("/favorites/locations", response_model=List[FavoriteLocationOut])
def list_favorite_locations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(FavoriteLocation).filter(FavoriteLocation.user_id == user.id).all()
    out = []
    for r in rows:
        item = FavoriteLocationOut.model_validate(r)
        item.location_name = _loc_name(db, r.location_id)
        out.append(item)
    return out


@router.post("/favorites/locations", response_model=FavoriteLocationOut, status_code=201)
def add_favorite_location(
    body: FavoriteLocationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(FavoriteLocation)
        .filter(
            FavoriteLocation.user_id == user.id,
            FavoriteLocation.location_id == body.location_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Déjà en favoris")
    fav = FavoriteLocation(
        user_id=user.id,
        location_id=body.location_id,
        label=body.label or _loc_name(db, body.location_id),
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    out = FavoriteLocationOut.model_validate(fav)
    out.location_name = fav.label
    return out


@router.delete("/favorites/locations/{fav_id}")
def remove_favorite_location(
    fav_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fav = (
        db.query(FavoriteLocation)
        .filter(FavoriteLocation.id == fav_id, FavoriteLocation.user_id == user.id)
        .first()
    )
    if not fav:
        raise HTTPException(status_code=404, detail="Favori introuvable")
    db.delete(fav)
    db.commit()
    return {"ok": True}


@router.get("/favorites/routes", response_model=List[FavoriteRouteOut])
def list_favorite_routes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(FavoriteRoute).filter(FavoriteRoute.user_id == user.id).all()
    out = []
    for r in rows:
        item = FavoriteRouteOut.model_validate(r)
        item.start_name = _loc_name(db, r.start_location_id)
        item.end_name = _loc_name(db, r.end_location_id)
        if not item.label:
            item.label = f"{item.start_name} → {item.end_name}"
        out.append(item)
    return out


@router.post("/favorites/routes", response_model=FavoriteRouteOut, status_code=201)
def add_favorite_route(
    body: FavoriteRouteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start_n = _loc_name(db, body.start_location_id)
    end_n = _loc_name(db, body.end_location_id)
    fav = FavoriteRoute(
        user_id=user.id,
        start_location_id=body.start_location_id,
        end_location_id=body.end_location_id,
        label=body.label or f"{start_n} → {end_n}",
        distance_m=body.distance_m,
    )
    db.add(fav)
    db.commit()
    db.refresh(fav)
    out = FavoriteRouteOut.model_validate(fav)
    out.start_name = start_n
    out.end_name = end_n
    return out


@router.delete("/favorites/routes/{fav_id}")
def remove_favorite_route(
    fav_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    fav = db.query(FavoriteRoute).filter(FavoriteRoute.id == fav_id, FavoriteRoute.user_id == user.id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favori introuvable")
    db.delete(fav)
    db.commit()
    return {"ok": True}


@router.get("/routes/history", response_model=List[RouteHistoryOut])
def list_route_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
):
    rows = (
        db.query(RouteHistory)
        .filter(RouteHistory.user_id == user.id)
        .order_by(RouteHistory.created_at.desc())
        .limit(min(limit, 50))
        .all()
    )
    out = []
    for r in rows:
        item = RouteHistoryOut(
            id=r.id,
            start_location_id=r.start_location_id,
            end_location_id=r.end_location_id,
            distance_m=r.distance_m,
            duration_min=r.duration_min,
            created_at=r.created_at.isoformat() if r.created_at else "",
            start_name=_loc_name(db, r.start_location_id),
            end_name=_loc_name(db, r.end_location_id),
        )
        out.append(item)
    return out


@router.post("/routes/history", response_model=RouteHistoryOut, status_code=201)
def add_route_history(
    body: RouteHistoryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = RouteHistory(
        user_id=user.id,
        start_location_id=body.start_location_id,
        end_location_id=body.end_location_id,
        distance_m=body.distance_m,
        duration_min=body.duration_min,
        path_json=body.path_json,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return RouteHistoryOut(
        id=entry.id,
        start_location_id=entry.start_location_id,
        end_location_id=entry.end_location_id,
        distance_m=entry.distance_m,
        duration_min=entry.duration_min,
        created_at=entry.created_at.isoformat() if entry.created_at else "",
        start_name=_loc_name(db, entry.start_location_id),
        end_name=_loc_name(db, entry.end_location_id),
    )
