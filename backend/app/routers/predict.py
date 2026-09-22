from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.predict_service import predict_congestion
from app.services.forecast_service import forecast_24h
from app.schemas.predict import PredictRequest, PredictResponse

router = APIRouter(prefix="/predict", tags=["predict"])


@router.post("", response_model=PredictResponse)
def predict(request: PredictRequest, db: Session = Depends(get_db)):
    """
    Prédit le niveau de congestion d'une salle à une date/heure donnée.

    Le champ `activite_prevue` est automatiquement déterminé depuis la table
    `schedules` — il n'est plus nécessaire de le fournir dans la requête.
    """
    try:
        return predict_congestion(db, request.location_id, request.datetime)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/forecast/{location_id}")
def forecast(location_id: int, db: Session = Depends(get_db)):
    """
    Prévision d'occupation 24 h (Phase 3) — profil horaire historique.

    Chaque point est qualifié `PREDICTED` avec bande min/max et confiance
    (taux d'échantillonnage). Déterministe et explicable, sans modèle ML.
    """
    try:
        return forecast_24h(db, location_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
