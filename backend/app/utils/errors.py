from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        detail = {"message": detail}

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": detail.get("code", "UNKNOWN_ERROR"),
                "message": detail.get("message", detail.get("message", str(detail))),
                "details": detail.get("details", {})
            },
            "status": exc.status_code
        }
    )