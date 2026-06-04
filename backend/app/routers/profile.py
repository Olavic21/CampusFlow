from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.models import User
from app.schemas.profile import ProfileOut
from app.utils.security import get_current_user
from app.utils.avatar_storage import (
    save_avatar,
    delete_avatar_file,
    build_avatar_url,
    ensure_avatar_dir,
)
from app.utils.logging_config import get_logger

router = APIRouter(prefix="/profile", tags=["profile"])
logger = get_logger("profile")


def _profile_out(user: User) -> ProfileOut:
    data = ProfileOut.model_validate(user)
    data.avatar = build_avatar_url(user.avatar)
    return data


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    return _profile_out(user)


@router.post("/avatar", response_model=ProfileOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Aucun fichier envoyé")

    try:
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="Fichier vide")

        old_path = user.avatar
        rel_path = save_avatar(user.id, file, raw)
        user.avatar = rel_path
        db.commit()
        db.refresh(user)
        delete_avatar_file(old_path)
        logger.info("Avatar updated — user_id=%s", user.id)
        return _profile_out(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Avatar upload failed — user_id=%s", user.id)
        raise HTTPException(status_code=500, detail="Erreur lors de l'envoi") from e


@router.delete("/avatar", response_model=ProfileOut)
def delete_avatar(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    old_path = user.avatar
    user.avatar = None
    db.commit()
    db.refresh(user)
    delete_avatar_file(old_path)
    logger.info("Avatar deleted — user_id=%s", user.id)
    return _profile_out(user)
