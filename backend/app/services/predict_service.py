"""
predict_service.py — Service de prédiction de congestion via ml/model.pkl.

Features attendues par le modèle (cf. ml/README.md) :
    location_id            int
    heure_du_jour          int   (0-23)
    jour_semaine           int   (0=Lundi … 5=Samedi)
    activite_prevue        int   (1 si cours planifié, 0 sinon)
    flux_moyen_historique  float (moyenne glissante sur 4 obs. par salle)
    capacite               int   (capacité max de la salle)

Le fichier model.pkl est un dict : {'model': <estimator>, 'label_reverse': {0: 'faible', …}}
"""
import joblib
import numpy as np
import pandas as pd
import os
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.config import settings
from app.database.models import Location, Flux, Schedule

# ── Chargement paresseux du modèle ───────────────────────────────────────────

_loaded: dict | None = None


def _load_model() -> dict:
    global _loaded
    if _loaded is not None:
        return _loaded

    path = settings.ML_MODEL_PATH
    if not os.path.exists(path):
        raise RuntimeError(f"Modèle ML introuvable : {path}")

    _loaded = joblib.load(path)  # {'model': ..., 'label_reverse': {0:'faible', ...}}
    return _loaded


# ── Helpers ───────────────────────────────────────────────────────────────────

def _activite_prevue(db: Session, location_id: int, dt: datetime) -> int:
    """Renvoie 1 si un cours/TP est planifié pour cette salle à cette heure."""
    schedule = (
        db.query(Schedule)
        .filter(
            Schedule.salle_id == location_id,
            Schedule.heure_debut <= dt,
            Schedule.heure_fin >= dt,
        )
        .first()
    )
    return 1 if schedule else 0


def _flux_moyen_historique(db: Session, location_id: int) -> float:
    """Moyenne glissante des 4 derniers enregistrements de flux pour cette salle."""
    rows = (
        db.query(Flux.nombre_etudiants)
        .filter(Flux.location_id == location_id)
        .order_by(Flux.timestamp.desc())
        .limit(4)
        .all()
    )
    if not rows:
        return 0.0
    return float(np.mean([r.nombre_etudiants for r in rows]))


# ── Service principal ─────────────────────────────────────────────────────────

def predict_congestion(db: Session, location_id: int, dt: datetime) -> dict:
    """
    Prédit le niveau de congestion pour une salle à un moment donné.

    Paramètres
    ----------
    db          : session SQLAlchemy
    location_id : ID de la salle (table locations)
    dt          : date-heure de la prédiction

    Retourne
    --------
    dict correspondant au schéma PredictResponse
    """
    loaded = _load_model()
    model = loaded["model"]
    label_reverse: dict = loaded.get("label_reverse", {0: "faible", 1: "moyen", 2: "eleve"})

    # Vérification de l'existence de la salle
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise ValueError(f"Salle introuvable : location_id={location_id}")

    # Construction des features
    features = pd.DataFrame([{
        "location_id":           location_id,
        "heure_du_jour":         dt.hour,
        "jour_semaine":          dt.weekday(),          # 0=Lundi … 6=Dimanche (5=Sam en usage campus)
        "activite_prevue":       _activite_prevue(db, location_id, dt),
        "flux_moyen_historique": _flux_moyen_historique(db, location_id),
        "capacite":              int(location.capacite),
    }])

    # Prédiction
    pred_idx = int(model.predict(features)[0])
    predicted_level = label_reverse.get(pred_idx, "inconnu")

    # Confiance (si le modèle expose predict_proba)
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(features)[0]
        confidence = float(np.max(proba))
    else:
        confidence = 0.75

    # Taux d'occupation simulé depuis l'index de niveau
    max_idx = max(label_reverse.keys()) if label_reverse else 2
    occupancy_rate = round((pred_idx / max(max_idx, 1)) * 0.85 + 0.1, 2)

    return {
        "location_id":              location_id,
        "predicted_level":          predicted_level,
        "confidence":               round(confidence, 2),
        "predicted_occupancy_rate": occupancy_rate,
        "model_version":            "v2.1.0",
    }
