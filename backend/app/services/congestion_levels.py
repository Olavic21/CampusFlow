"""
congestion_levels.py — Source canonique des seuils et niveaux de congestion.

Vocabulaire unique partagé backend ↔ frontend :
  • Niveau API (enum, aligné schéma CongestionLevel) : low | medium | high | critical
  • Libellé FR (UI)                                  : Disponible | Modéré | Chargé | Saturé
  • Valeur stockée BDD (colonne niveau_congestion)   : faible | moyen | eleve | critique
  • Seuils (taux d'occupation)                        : 0.4 | 0.7 | 0.9

Ne jamais réintroduire de seuils/niveaux « parallèles » dans ingest,
congestion_service, predict ou le frontend : passer ici.

⚠️ Seuils alignés sur frontend/src/utils/congestionColor.js
   (0.4 → Disponible, 0.7 → Modéré, 0.9 → Chargé, sinon → Saturé).
"""

from dataclasses import dataclass

# ── Seuils d'occupation (taux) ───────────────────────────────────────────────
SEUIL_LOW:        float = 0.4   # < 0.4  → low    / Disponible
SEUIL_MODERE:     float = 0.7   # < 0.7  → medium / Modéré
SEUIL_CHARGE:     float = 0.9   # < 0.9  → high   / Chargé
                                # >= 0.9 → critical / Saturé

# ── Niveau API (enum canonique) ──────────────────────────────────────────────
LOW      = "low"
MEDIUM   = "medium"
HIGH     = "high"
CRITICAL = "critical"

LEVELS = (LOW, MEDIUM, HIGH, CRITICAL)

# ── Valeurs stockées en BDD (colonne niveau_congestion, historique) ──────────
DB_FAIBLE   = "faible"
DB_MOYEN    = "moyen"
DB_ELEVE    = "eleve"
DB_CRITIQUE = "critique"

_DB_LEVEL_MAP = {
    LOW:      DB_FAIBLE,
    MEDIUM:   DB_MOYEN,
    HIGH:     DB_ELEVE,
    CRITICAL: DB_CRITIQUE,
}

# ── Libellés FR (UI — badge, fiche bâtiment) ─────────────────────────────────
LABEL_FR = {
    LOW:      "Disponible",
    MEDIUM:   "Modéré",
    HIGH:     "Chargé",
    CRITICAL: "Saturé",
}

# ── Seuils en ordre (pour itération) ─────────────────────────────────────────
_SEUILS = ((CRITICAL, SEUIL_CHARGE), (HIGH, SEUIL_MODERE), (MEDIUM, SEUIL_LOW))


def congestion_level_from_taux(taux: float | None) -> str:
    """Déduit le niveau canonique depuis un taux d'occupation (0..1)."""
    if taux is None or taux < SEUIL_LOW:
        return LOW
    if taux < SEUIL_MODERE:
        return MEDIUM
    if taux < SEUIL_CHARGE:
        return HIGH
    return CRITICAL


def db_value_for_level(level: str) -> str:
    """Niveau API → valeur stockée en BDD (faible/moyen/eleve/critique)."""
    return _DB_LEVEL_MAP.get(level, DB_FAIBLE)


def label_fr_for_level(level: str) -> str:
    """Niveau API → libellé FR d'affichage."""
    return LABEL_FR.get(level, LABEL_FR[LOW])


@dataclass(frozen=True)
class CongestionInfo:
    level: str        # low|medium|high|critical
    db_value: str     # faible|moyen|eleve|critique
    label_fr: str     # Disponible|Modéré|Chargé|Saturé
    taux: float


def congestion_info_from_taux(taux: float | None) -> CongestionInfo:
    level = congestion_level_from_taux(taux)
    return CongestionInfo(
        level=level,
        db_value=db_value_for_level(level),
        label_fr=label_fr_for_level(level),
        taux=min(max(taux or 0.0, 0.0), 1.0),
    )
