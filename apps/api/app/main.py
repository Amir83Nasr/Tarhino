from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.router import router as ai_router
from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.reports.router import router as reports_router
from app.teaching.router import all_routers as teaching_routers
from app.users.router import router as users_router

API_PREFIX = "/api/v1"

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url=None,
)

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
