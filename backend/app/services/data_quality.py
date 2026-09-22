"""
data_quality.py — Qualification canonique de la fraîcheur des données.

Toute donnée temps réel doit pouvoir être qualifiée :
    REAL       — lecture capteur récente (source != simulation)
    SIMULATED  — lecture générée par le simulateur
    STALE      — dernière lecture au-delà de STALE_AFTER_SEC
    UNKNOWN    — aucune donnée

Ne jamais réintroduire de seuils « parallèles » ailleurs : passer ici.
"""
from datetime import datetime, timedelta, timezone

from app.config import settings


def _as_utc(ts: datetime) -> datetime:
    """Normalise naive (UTC implicite, convention projet) → aware UTC."""
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts


def age_seconds(ts: datetime | None, now: datetime | None = None) -> float | None:
    """Âge d'une lecture en secondes (None si inconnu). Naive et aware acceptés."""
    if ts is None:
        return None
    now = now or datetime.now(timezone.utc)
    return max(0.0, (_as_utc(now) - _as_utc(ts)).total_seconds())


def is_stale(
    ts: datetime | None,
    now: datetime | None = None,
    threshold_sec: int | None = None,
) -> bool:
    """True si la lecture est absente ou plus vieille que le seuil."""
    age = age_seconds(ts, now)
    if age is None:
        return True
    threshold = threshold_sec or settings.STALE_AFTER_SEC
    return age > threshold


def freshness(ts: datetime | None, now: datetime | None = None) -> str:
    """Étiquette canonique : real | simulated-neutral → voir source. Ici : fresh|stale|unknown."""
    if ts is None:
        return "unknown"
    return "stale" if is_stale(ts, now) else "fresh"


def cutoff_for(window_minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=window_minutes)