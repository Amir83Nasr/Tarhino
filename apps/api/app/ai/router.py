from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.core.vault import decrypt_secret, encrypt_secret
from app.db.session import get_session
from app.schemas.ai import (
    AiSettingsAndUser,
    AiSettingsOut,
    AiSettingsUpdate,
    ChatRequest,
    ChatResponse,
)
from app.schemas.user import UserOut

router = APIRouter(prefix="/ai", tags=["ai"])

Session = Annotated[AsyncSession, Depends(get_session)]

_TIMEOUT = httpx.Timeout(60.0)

_UPSTREAM_ERRORS: dict[int, str] = {
    401: "کلید معتبر نیست",
    402: "اعتبار حساب هوش مصنوعی تمام شده است",
    429: "تعداد درخواست زیاد است؛ کمی بعد تلاش کنید",
}


def _defaults() -> tuple[str, str, str]:
    settings = get_settings()
    return (
        settings.ai_default_base_url.rstrip("/"),
        settings.ai_default_model.strip() or "liquid/lfm-2.5-2.6b:free",
        settings.ai_default_api_key.strip(),
    )


def _view(user: CurrentUser) -> AiSettingsOut:
    default_base_url, default_model, default_key = _defaults()
    has_own_key = user.ai_api_key_enc is not None
    return AiSettingsOut(
        base_url=user.ai_base_url or default_base_url,
        model=user.ai_model or default_model,
        has_key=has_own_key or bool(default_key),
        is_default=not has_own_key and bool(default_key),
    )


def _credentials(user: CurrentUser) -> tuple[str, str, str]:
    """Return (api_key, base_url, model); 409 when no key is stored.

    Per-user values win; the shared server default fills whatever the user
    left empty.
    """
    default_base_url, default_model, default_key = _defaults()
    base_url = (user.ai_base_url or default_base_url).rstrip("/")
    model = (user.ai_model or default_model).strip() or default_model
    key = decrypt_secret(user.ai_api_key_enc) if user.ai_api_key_enc else None
    key = key or default_key or None
    if not key:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "هوش مصنوعی تنظیم نشده است؛ کلید را در تنظیمات وارد کنید",
        )
    return key, base_url, model


@router.get("/settings", response_model=AiSettingsOut)
async def read_settings(user: CurrentUser) -> AiSettingsOut:
    return _view(user)


@router.put("/settings", response_model=AiSettingsAndUser)
async def update_settings(
    data: AiSettingsUpdate, user: CurrentUser, session: Session
) -> AiSettingsAndUser:
    if data.base_url is not None:
        user.ai_base_url = data.base_url.strip() or None
    if data.model is not None:
        user.ai_model = data.model.strip() or None
    if data.api_key is not None:
        key = data.api_key.strip()
        if key:
            user.ai_api_key_enc = encrypt_secret(key)
    await session.commit()
    await session.refresh(user)
    return AiSettingsAndUser(settings=_view(user), user=UserOut.model_validate(user))


@router.delete("/settings/key", response_model=AiSettingsOut)
async def delete_key(user: CurrentUser, session: Session) -> AiSettingsOut:
    user.ai_api_key_enc = None
    await session.commit()
    await session.refresh(user)
    return _view(user)


@router.post("/chat", response_model=ChatResponse)
async def chat(data: ChatRequest, user: CurrentUser) -> ChatResponse:
    api_key, base_url, model = _credentials(user)
    messages = [{"role": m.role, "content": m.content} for m in data.messages]

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            upstream = await client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://tarhino.app",
                    "X-Title": "Tarhino",
                },
                json={"model": model, "messages": messages},
            )
    except httpx.HTTPError:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "ارتباط سرور با سرویس هوش مصنوعی برقرار نشد",
        ) from None

    payload: Any = None
    try:
        payload = upstream.json()
    except ValueError:
        payload = None

    record = payload if isinstance(payload, dict) else {}
    if record.get("type") == "error" or upstream.status_code >= 400:
        known = _UPSTREAM_ERRORS.get(upstream.status_code)
        if known:
            raise HTTPException(upstream.status_code, known)
        detail = (
            (record.get("error") or {}).get("message")
            if isinstance(record.get("error"), dict)
            else None
        )
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail
            if isinstance(detail, str) and detail[:300]
            else ("پاسخ گرفته نشد؛ آدرس سرویس و مدل را بررسی کنید"),
        )

    choices = record.get("choices")
    text = choices[0].get("message", {}).get("content") if choices else None
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "پاسخ خالی بود؛ دوباره تلاش کنید")
    return ChatResponse(text=text.strip())
