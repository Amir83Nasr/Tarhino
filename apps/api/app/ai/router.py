import json
from collections.abc import AsyncIterator

import httpx
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser
from app.core.config import get_settings
from app.schemas.ai import ChatRequest

router = APIRouter(prefix="/ai", tags=["ai"])

_TIMEOUT = httpx.Timeout(60.0)

_UPSTREAM_ERRORS: dict[int, str] = {
    401: "کلید معتبر نیست",
    402: "اعتبار حساب هوش مصنوعی تمام شده است",
    429: "تعداد درخواست زیاد است؛ کمی بعد تلاش کنید",
}

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _credentials() -> tuple[str, str, str]:
    """Return (api_key, base_url, model) from server config; 503 when unset."""
    settings = get_settings()
    base_url = settings.ai_base_url.rstrip("/")
    model = settings.ai_model.strip() or "liquid/lfm-2.5-2.6b:free"
    key = settings.ai_api_key.strip() or None
    if not key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "هوش مصنوعی فعال نیست",
        )
    return key, base_url, model


def _token_of(line: str) -> str | None:
    """Text token carried by one OpenRouter SSE line; None when it carries none.

    Control lines (`: comment`, `data: [DONE]`), role-only deltas, and error
    chunks all yield None — HTTP-level failures already raise with a Persian
    message before streaming starts.
    """
    if not line.startswith("data:"):
        return None
    data = line[5:].strip()
    if not data or data == "[DONE]":
        return None
    try:
        chunk = json.loads(data)
    except ValueError:
        return None
    choices = chunk.get("choices") if isinstance(chunk, dict) else None
    first = choices[0] if choices else None
    delta = first.get("delta") if isinstance(first, dict) else None
    content = delta.get("content") if isinstance(delta, dict) else None
    return content if isinstance(content, str) and content else None


def _upstream_error(status_code: int, record: dict) -> HTTPException:
    known = _UPSTREAM_ERRORS.get(status_code)
    if known:
        return HTTPException(status_code, known)
    detail = (
        (record.get("error") or {}).get("message")
        if isinstance(record.get("error"), dict)
        else None
    )
    return HTTPException(
        status.HTTP_502_BAD_GATEWAY,
        detail
        if isinstance(detail, str) and detail[:300]
        else ("پاسخ گرفته نشد؛ آدرس سرویس و مدل را بررسی کنید"),
    )


@router.post("/chat")
async def chat(data: ChatRequest, user: CurrentUser) -> StreamingResponse:
    """Proxy OpenRouter as SSE so replies render token-by-token."""
    api_key, base_url, model = _credentials()
    messages = [{"role": m.role, "content": m.content} for m in data.messages]

    client = httpx.AsyncClient(timeout=_TIMEOUT)
    try:
        upstream = await client.send(
            client.build_request(
                "POST",
                f"{base_url}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://tarhino.app",
                    "X-Title": "Tarhino",
                },
                json={"model": model, "messages": messages, "stream": True},
            ),
            stream=True,
        )
    except httpx.HTTPError:
        await client.aclose()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "ارتباط سرور با سرویس هوش مصنوعی برقرار نشد",
        ) from None

    if upstream.status_code >= 400:
        try:
            record = json.loads(await upstream.aread())
        except ValueError:
            record = {}
        await upstream.aclose()
        await client.aclose()
        raise _upstream_error(upstream.status_code, record if isinstance(record, dict) else {})

    async def _proxy() -> AsyncIterator[str]:
        try:
            async for line in upstream.aiter_lines():
                token = _token_of(line)
                if token is not None:
                    yield f"data: {json.dumps(token)}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            await upstream.aclose()
            await client.aclose()

    return StreamingResponse(_proxy(), media_type="text/event-stream", headers=_SSE_HEADERS)
