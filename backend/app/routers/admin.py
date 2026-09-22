"""Phase 5 — Console d'administration : gestion des utilisateurs (RBAC admin)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.models import User
from app.database.session import get_db
from app.schemas.admin import AdminUserOut, AdminUserUpdate
from app.utils.security import require_role

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_ROLES = ("student", "staff", "admin")


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    current: User = Depends(require_role("admin")),
):
    """Liste des comptes — réservé admin."""
    rows = db.query(User).order_by(User.id).limit(200).all()
    return [AdminUserOut.model_validate(u) for u in rows]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_role("admin")),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Rôle invalide")
        target.role = body.role
    if body.is_active is not None:
        if target.id == current.id and not body.is_active:
            raise HTTPException(
                status_code=400, detail="Impossible de désactiver son propre compte"
            )
        target.is_active = body.is_active
    db.commit()
    db.refresh(target)
    return AdminUserOut.model_validate(target)