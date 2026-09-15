from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.models.user import RefreshToken, User
from app.schemas.auth import RegisterRequest

# Verified against when the phone is unknown, so a missing account costs the same
# time as a wrong password and cannot be detected by timing.
_DUMMY_HASH = hash_password("timing-equalizer-not-a-real-password")


# ── REGISTER ───────────────────────────────────────────────


async def register(session: AsyncSession, data: RegisterRequest) -> User:
    user = User(
        phone=data.phone,
        first_name=data.first_name,
        last_name=data.last_name,
        password_hash=hash_password(data.password),
        grading_mode="descriptive",
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone number already registered") from None
    await session.commit()
    await session.refresh(user)
    return user


# ── PHONE LOOKUP ───────────────────────────────────────────


async def phone_exists(session: AsyncSession, phone: str) -> bool:
    """Drives the unified auth form: existing account asks for a password,
    unknown phone asks for name + password. Deliberately a public endpoint."""
    return await session.scalar(select(User.id).where(User.phone == phone)) is not None


# ── LOGIN ──────────────────────────────────────────────────


async def authenticate(session: AsyncSession, phone: str, password: str) -> User:
    user = await session.scalar(select(User).where(User.phone == phone))

    if user is None:
        verify_password(_DUMMY_HASH, password)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid phone or password")

    if not verify_password(user.password_hash, password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid phone or password")

    return user


# ── TOKENS ─────────────────────────────────────────────────


async def issue_tokens(
    session: AsyncSession, user: User, user_agent: str | None = None
) -> tuple[str, str]:
    """Return (access_token, raw_refresh_token)."""
    settings = get_settings()
    access_token = create_access_token(str(user.id))
    raw, token_hash = new_refresh_token()

    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            user_agent=user_agent[:512] if user_agent else None,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    await session.commit()
    return access_token, raw


async def rotate_refresh_token(
    session: AsyncSession, raw: str, user_agent: str | None = None
) -> tuple[User, str, str]:
    """Consume a refresh token and return (user, access_token, new_raw_refresh_token)."""
    now = datetime.now(UTC)
    token = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw))
    )

    if token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    if token.revoked_at is not None or token.expires_at <= now:
        # A rotated or expired token came back: assume it leaked and drop every
        # live session for that user. ponytail: whole-user revocation instead of
        # per-family tracking; split into token families if multi-device churn
        # ever makes this disruptive.
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == token.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await session.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token no longer valid")

    user = await session.get(User, token.user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    token.revoked_at = now
    access_token = create_access_token(str(user.id))
    raw_new, hash_new = new_refresh_token()
    kept_ua = user_agent or token.user_agent
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_new,
            user_agent=kept_ua[:512] if kept_ua else None,
            expires_at=now + timedelta(days=get_settings().refresh_token_expire_days),
        )
    )
    await session.commit()
    return user, access_token, raw_new


async def revoke_refresh_token(session: AsyncSession, raw: str) -> None:
    """Idempotent: an unknown or already-revoked token is a no-op."""
    await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_refresh_token(raw),
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    await session.commit()
