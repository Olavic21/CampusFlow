from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.routers import locations, congestion, flux, path, predict, feedbacks, dashboard, auth, users, profile
from app.utils.errors import http_exception_handler, validation_exception_handler
from app.utils.logging_config import setup_logging
from fastapi.exceptions import RequestValidationError

app = FastAPI(
    title="CampusFlow API",
    version="1.0",
    description="API de gestion du flux et de la congestion sur le campus SUP'PTIC",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,   # lu depuis .env → CORS_ORIGINS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gestionnaire d'erreurs global ────────────────────────────────────────────
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(locations.router)
app.include_router(congestion.router)
app.include_router(flux.router)
app.include_router(path.router)
app.include_router(predict.router)
app.include_router(feedbacks.router)
app.include_router(dashboard.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(profile.router)

_media_path = Path(settings.MEDIA_ROOT)
_media_path.mkdir(parents=True, exist_ok=True)
(_media_path / settings.AVATAR_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount(
    settings.MEDIA_URL,
    StaticFiles(directory=str(_media_path)),
    name="media",
)


@app.on_event("startup")
def on_startup():
    setup_logging()
    from app.database.init_db import init_db
    from app.utils.avatar_storage import ensure_avatar_dir

    init_db()
    ensure_avatar_dir()


@app.get("/", tags=["health"])
def root():
    return {"message": "CampusFlow API opérationnelle", "version": "1.0"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
