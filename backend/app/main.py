from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.routers import locations, congestion, flux, path, predict, feedbacks, dashboard
from app.utils.errors import http_exception_handler

app = FastAPI(title="CampusFlow Lite API", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gestionnaire d'erreurs global
app.add_exception_handler(HTTPException, http_exception_handler)

# Routers
app.include_router(locations.router)
app.include_router(congestion.router)
app.include_router(flux.router)
app.include_router(path.router)
app.include_router(predict.router)
app.include_router(feedbacks.router)
app.include_router(dashboard.router)

@app.get("/")
def root():
    return {"message": "CampusFlow Lite API operational"}