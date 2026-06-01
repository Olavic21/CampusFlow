from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import locations, congestion, flux, path, predict, feedbacks, dashboard
from app.utils.errors import http_exception_handler

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

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(locations.router)
app.include_router(congestion.router)
app.include_router(flux.router)
app.include_router(path.router)
app.include_router(predict.router)
app.include_router(feedbacks.router)
app.include_router(dashboard.router)


@app.get("/", tags=["health"])
def root():
    return {"message": "CampusFlow API opérationnelle", "version": "1.0"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
