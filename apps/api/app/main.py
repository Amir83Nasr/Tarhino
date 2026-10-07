import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.ai.router import router as ai_router
from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.reports.router import router as reports_router
from app.teaching.router import all_routers as teaching_routers
from app.users.router import router as users_router

API_PREFIX = "/api/v1"

logger = logging.getLogger("uvicorn.error")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url=None,
)


class CatchUnhandledMiddleware(BaseHTTPMiddleware):
    """Turn unhandled exceptions into JSON 500s before CORS sees them.

    Without this, exceptions escape to ServerErrorMiddleware (outside CORS),
    so the 500 has no Access-Control-Allow-Origin, the browser rejects the
    response as a network failure, and the UI shows a misleading
    "connection failed" message instead of the real server error.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse({"detail": "Internal Server Error"}, status_code=500)


# Registered before CORS so it sits *inside* the CORS layer (Starlette's last
# add_middleware wins the outermost slot) and CORS headers land on its 500s.
app.add_middleware(CatchUnhandledMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(ai_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
for _router in teaching_routers:
    app.include_router(_router, prefix=API_PREFIX)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
