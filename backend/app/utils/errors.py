from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


def _message_from_detail(detail) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, dict):
        return detail.get("message") or str(detail)
    return str(detail)


async def http_exception_handler(request: Request, exc: HTTPException):
    message = _message_from_detail(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": message,
            "error": {
                "code": "HTTP_ERROR",
                "message": message,
            },
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    parts = []
    for err in exc.errors():
        loc = err.get("loc", ())
        field = loc[-1] if len(loc) > 1 else "champ"
        msg = err.get("msg", "valeur invalide")
        if "email" in str(field).lower() and "valid" in msg.lower():
            parts.append("Adresse email invalide")
        elif "password" in str(field).lower() and "at least" in msg.lower():
            parts.append("Mot de passe trop faible")
        else:
            parts.append(f"{field}: {msg}")
    message = ". ".join(parts) if parts else "Données invalides"
    return JSONResponse(
        status_code=422,
        content={"detail": message, "error": {"code": "VALIDATION_ERROR", "message": message}},
    )
