from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.predict_service import predict_congestion
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
