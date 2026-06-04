from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.database.session import get_db
from app.database.models import User, UserPreference
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    UserOut,
    TokenResponse,
    PreferencesOut,
    PreferencesUpdate,
)
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.utils.logging_config import get_logger
from app.utils.avatar_storage import build_avatar_url

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger("auth")


def _user_to_out(user: User) -> UserOut:
    out = UserOut.model_validate(user)
    out.avatar = build_avatar_url(user.avatar)
    return out


def _ensure_preferences(db: Session, user: User) -> UserPreference:
    prefs = db.query(UserPreference).filter(UserPreference.user_id == user.id).first()
    if not prefs:
        prefs = UserPreference(user_id=user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        user=_user_to_out(user),
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    logger.info("Registration started — email=%s username=%s", body.email, body.username)
    try:
        if db.query(User).filter(User.email == body.email.lower()).first():
            logger.warning("Registration failed — email already used: %s", body.email)
            raise HTTPException(status_code=400, detail="Adresse email déjà utilisée")
        if db.query(User).filter(User.username == body.username.strip().lower()).first():
            logger.warning("Registration failed — username taken: %s", body.username)
            raise HTTPException(status_code=400, detail="Ce nom d'utilisateur est déjà pris")

        user = User(
            full_name=body.full_name.strip(),
            email=body.email.lower(),
            username=body.username.strip().lower(),
            hashed_password=hash_password(body.password),
        )
        db.add(user)
        db.flush()
        db.add(UserPreference(user_id=user.id))
        db.commit()
        db.refresh(user)

        logger.info("Registration success — user_id=%s", user.id)
        return _token_response(user)
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Registration failed — database error")
        raise HTTPException(
            status_code=500,
            detail="Erreur serveur lors de la création du compte",
        )
    except Exception:
        db.rollback()
        logger.exception("Registration failed — unexpected error")
        raise HTTPException(status_code=500, detail="Impossible de créer le compte")


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    login_val = body.login.strip().lower()
    logger.info("Login attempt — login=%s", login_val)
    try:
        user = (
            db.query(User)
            .filter((User.email == login_val) | (User.username == login_val))
            .first()
        )
        if not user or not verify_password(body.password, user.hashed_password):
            logger.warning("Login failed — invalid credentials for %s", login_val)
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
        if not user.is_active:
            logger.warning("Login failed — inactive account user_id=%s", user.id)
            raise HTTPException(status_code=403, detail="Compte désactivé")

        user.last_login = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        logger.info("Login success — user_id=%s", user.id)
        return _token_response(user)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Login failed — unexpected error")
        raise HTTPException(status_code=500, detail="Erreur serveur lors de la connexion")


@router.post("/logout")
def logout(user: User = Depends(get_current_user)):
    logger.info("Logout — user_id=%s", user.id)
    return {"message": "Déconnexion réussie", "detail": "Déconnexion réussie"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return _user_to_out(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    logger.info("Token refresh requested")
    try:
        payload = decode_token(body.refresh_token, "refresh")
        user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active.is_(True)).first()
        if not user:
            logger.warning("Token refresh failed — user not found")
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        logger.info("Token refresh success — user_id=%s", user.id)
        return _token_response(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Token refresh failed — %s", e)
        raise HTTPException(status_code=401, detail="Session expirée — reconnectez-vous") from e


@router.get("/me/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _ensure_preferences(db, user)


@router.patch("/me/preferences", response_model=PreferencesOut)
def update_preferences(
    body: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = _ensure_preferences(db, user)
    if body.theme is not None:
        prefs.theme = body.theme
    if body.navigation_mode is not None:
        prefs.navigation_mode = body.navigation_mode
    if body.extra is not None:
        prefs.extra = body.extra
    db.commit()
    db.refresh(prefs)
    return prefs
