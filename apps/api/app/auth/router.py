from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.core.config import get_settings
from app.db.session import get_session
from app.schemas.auth import (
    LoginRequest,
    PhoneCheckRequest,
    PhoneCheckResponse,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

Session = Annotated[AsyncSession, Depends(get_session)]
RefreshCookie = Annotated[str | None, Cookie(alias="refresh_token")]

REFRESH_COOKIE = "refresh_token"
# Root path: the cookie has to be visible to the web app's route guard, not just
# to /auth/*. The refresh token is httpOnly either way.
COOKIE_PATH = "/"
_MAX_AGE = get_settings().refresh_token_expire_days * 24 * 60 * 60


# ── COOKIE HELPERS ─────────────────────────────────────────


def _set_refresh_cookie(response: Response, raw: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE,
        raw,
        max_age=_MAX_AGE,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        path=COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)


# ── ROUTES ─────────────────────────────────────────────────


@router.post("/check-phone", response_model=PhoneCheckResponse)
async def check_phone(data: PhoneCheckRequest, session: Session) -> PhoneCheckResponse:
    return PhoneCheckResponse(exists=await service.phone_exists(session, data.phone))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, session: Session) -> UserOut:
    return await service.register(session, data)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, response: Response, session: Session) -> TokenResponse:
    user = await service.authenticate(session, data.phone, data.password)
    access_token, raw_refresh = await service.issue_tokens(session, user)
    _set_refresh_cookie(response, raw_refresh)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    session: Session,
    refresh_token: RefreshCookie = None,
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing refresh token")

    user, access_token, raw_refresh = await service.rotate_refresh_token(session, refresh_token)
    _set_refresh_cookie(response, raw_refresh)
    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    session: Session,
    refresh_token: RefreshCookie = None,
) -> None:
    if refresh_token:
        await service.revoke_refresh_token(session, refresh_token)
    _clear_refresh_cookie(response)
