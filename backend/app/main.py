import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.routers import (
    locations,
    congestion,
    flux,
    path,
    predict,
    feedbacks,
    dashboard,
    auth,
    users,
    profile,
    sensors,
    ws,
    incidents,
    admin,
)
from app.utils.errors import http_exception_handler, validation_exception_handler
from app.utils.logging_config import setup_logging
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger("campusflow.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.database.init_db import init_db
    from app.database.session import SessionLocal
    from app.sensors.services.ingest import ensure_sensors_seeded
    from app.sensors.simulators.engine import get_simulator
    from app.sensors.mqtt.client import start_mqtt_listener
    from app.sensors.websocket.hub import occupancy_hub
    from app.services.retention_service import retention_loop
    from app.utils.avatar_storage import ensure_avatar_dir

    setup_logging()
    init_db()
    ensure_avatar_dir()

    with SessionLocal() as db:
        n = ensure_sensors_seeded(db)
        if n:
            print(f"  {n} capteurs simulés créés")

    # Pont thread-safe pour les callbacks MQTT (paho tourne dans son propre thread)
    occupancy_hub.set_loop(asyncio.get_running_loop())

    mode = settings.SENSOR_MODE
    sim_task = None
    if mode in ("simulation", "hybrid"):
        sim_task = asyncio.create_task(get_simulator().run_forever())
    if mode in ("mqtt", "hybrid"):
        if not start_mqtt_listener():
            logger.warning("MQTT demandé mais indisponible — vérifier MQTT_BROKER_URL et paho-mqtt")

    retention_task = asyncio.create_task(retention_loop())

    yield

    for task in (sim_task, retention_task):
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="CampusFlow API",
    version="1.0",
    description="API de gestion du flux et de la congestion sur le campus SUP'PTIC",
    lifespan=lifespan,
)

# ── CORS + compression ───────────────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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
app.include_router(sensors.router)
app.include_router(ws.router)
app.include_router(incidents.router)
app.include_router(admin.router)

_media_path = Path(settings.MEDIA_ROOT)
_media_path.mkdir(parents=True, exist_ok=True)
(_media_path / settings.AVATAR_UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount(
    settings.MEDIA_URL,
    StaticFiles(directory=str(_media_path)),
    name="media",
)


@app.get("/", tags=["health"])
def root():
    return {"message": "CampusFlow API opérationnelle", "version": "1.0"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
