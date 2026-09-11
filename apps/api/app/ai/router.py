from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
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

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "liquid/lfm-2.5-2.6b:free"
_TIMEOUT = httpx.Timeout(60.0)

_UPSTREAM_ERRORS: dict[int, str] = {
    401: "کلید معتبر نیست",
    402: "اعتبار حساب هوش مصنوعی تمام شده است",
    429: "تعداد درخواست زیاد است؛ کمی بعد تلاش کنید",
}


def _view(user: CurrentUser) -> AiSettingsOut:
    return AiSettingsOut(
        base_url=user.ai_base_url,
        model=user.ai_model,
        has_key=user.ai_api_key_enc is not None,
    )


def _credentials(user: CurrentUser) -> tuple[str, str, str]:
    """Return (api_key, base_url, model); 409 when no key is stored."""
    base_url = (user.ai_base_url or DEFAULT_BASE_URL).rstrip("/")
    model = (user.ai_model or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    key = decrypt_secret(user.ai_api_key_enc) if user.ai_api_key_enc else None
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


@router.delete("/settings/key", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(user: CurrentUser, session: Session) -> Response:
    user.ai_api_key_enc = None
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
