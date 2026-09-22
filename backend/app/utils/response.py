"""
response.py — Helpers pour des réponses JSON cohérentes.

Utilisé par les routers pour uniformiser les réponses de succès
et les messages d'erreur métier, en complément du gestionnaire
global d'exceptions dans errors.py.
"""
from typing import Any, Optional
from fastapi.responses import JSONResponse


def success(data: Any, status_code: int = 200) -> JSONResponse:
    """Réponse de succès enveloppée."""
    return JSONResponse(status_code=status_code, content={"data": data, "status": status_code})


def error(message: str, code: str = "ERROR", status_code: int = 400, details: Optional[dict] = None) -> JSONResponse:
    """Réponse d'erreur métier structurée (sans lever d'exception)."""
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            },
            "status": status_code,
        },
    )
