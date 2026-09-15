import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.device import parse_device
from app.core.security import hash_password, hash_refresh_token, verify_password
from app.db.session import get_session
from app.models.user import RefreshToken
from app.schemas.user import (
    ChangePasswordRequest,
    GradingModeOut,
    GradingModeUpdate,
    SessionOut,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])

Session = Annotated[AsyncSession, Depends(get_session)]
RefreshCookie = Annotated[str | None, Cookie(alias="refresh_token")]

# ── ME ─────────────────────────────────────────────────────


def _out(user: object) -> UserOut:
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
async def read_me(user: CurrentUser) -> UserOut:
    return _out(user)


@router.patch("/me", response_model=UserOut)
async def update_me(payload: UserUpdate, user: CurrentUser, session: Session) -> UserOut:
    data = payload.model_dump(exclude_unset=True)
    for key in ("first_name", "last_name"):
        if isinstance(data.get(key), str):
            data[key] = data[key].strip()
            if not data[key]:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid {key}")
    if not data:
        return _out(user)
    for key, value in data.items():
        setattr(user, key, value)
    await session.commit()
    await session.refresh(user)
    return _out(user)


@router.post("/me/grading-mode", response_model=GradingModeOut)
async def set_grading_mode(
    payload: GradingModeUpdate, user: CurrentUser, session: Session
) -> GradingModeOut:
    """Switch the whole-teacher grading mode and convert old grades with it.

    Old rows keep working either way (value stays the averaging anchor):
    - → descriptive: each value re-described under its subject's scale.
    - → numeric: stored labels kept as-is (they already match their values).
    """
    from app.models.teaching import Assessment, Grade, SubjectGradeScale
    from app.reports.grades import DEFAULT_SCALE, GradeScaleBands, describe_level

    user.grading_mode = payload.grading_mode
    converted = 0
    if payload.grading_mode == "descriptive":
        scales = {
            str(s.subject_id): GradeScaleBands(
                excellent_min=float(s.excellent_min),
                good_min=float(s.good_min),
                pass_min=float(s.pass_min),
                excellent_label=s.excellent_label,
                good_label=s.good_label,
                fair_label=s.fair_label,
                needs_label=s.needs_label,
            )
            for s in await session.scalars(
                select(SubjectGradeScale).where(SubjectGradeScale.user_id == user.id)
            )
        }
        subjects = {
            str(a.id): str(a.subject_id)
            for a in await session.scalars(select(Assessment).where(Assessment.user_id == user.id))
        }
        rows = list(await session.scalars(select(Grade).where(Grade.user_id == user.id)))
        for row in rows:
            scale = scales.get(subjects.get(str(row.assessment_id), ""), DEFAULT_SCALE)
            row.label = describe_level(float(row.value), scale)
            converted += 1
    await session.commit()
    await session.refresh(user)
    return GradingModeOut(user=_out(user), converted=converted)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest, user: CurrentUser, session: Session
) -> None:
    if not verify_password(user.password_hash, payload.current_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid phone or password")
    user.password_hash = hash_password(payload.new_password)
    await session.commit()


# ── SESSIONS ───────────────────────────────────────────────


async def _live_sessions(
    session: AsyncSession, user_id: uuid.UUID, current_hash: str | None
) -> list[SessionOut]:
    rows = list(
        await session.scalars(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(UTC),
            )
            .order_by(RefreshToken.created_at.desc())
        )
    )
    return [
        SessionOut(
            id=row.id,
            created_at=row.created_at,
            expires_at=row.expires_at,
            is_current=current_hash is not None and row.token_hash == current_hash,
            device=parse_device(row.user_agent),
        )
        for row in rows
    ]


@router.get("/me/sessions", response_model=list[SessionOut])
async def list_sessions(
    user: CurrentUser, session: Session, refresh_token: RefreshCookie = None
) -> list[SessionOut]:
    current_hash = hash_refresh_token(refresh_token) if refresh_token else None
    return await _live_sessions(session, user.id, current_hash)


@router.post("/me/sessions/revoke-others", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_other_sessions(
    user: CurrentUser, session: Session, refresh_token: RefreshCookie = None
) -> None:
    stmt = update(RefreshToken).where(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None),
    )
    if refresh_token:
        stmt = stmt.where(RefreshToken.token_hash != hash_refresh_token(refresh_token))
    await session.execute(stmt.values(revoked_at=datetime.now(UTC)))
    await session.commit()


# ── PURGE DATA ───────────────────────────────────────────


@router.delete("/me/data", status_code=status.HTTP_204_NO_CONTENT)
async def purge_my_data(user: CurrentUser, session: Session) -> None:
    """Delete everything the account owns, keep the account itself.

    Leaf rows go first so bulk deletes never hit a FK from a child that is
    still there. Sessions and the user row stay: the caller remains logged in.
    Irreversible.
    """
    from app.models.teaching import (
        Assessment,
        ClassSubject,
        Grade,
        Holiday,
        LessonPlan,
        Period,
        School,
        Student,
        Subject,
        SubjectGradeScale,
        TeachingClass,
    )

    for model in (
        Grade,
        LessonPlan,
        Assessment,
        SubjectGradeScale,
        ClassSubject,
        Period,
        Student,
        Subject,
        TeachingClass,
        School,
    ):
        await session.execute(delete(model).where(model.user_id == user.id))
    await session.execute(delete(Holiday).where(Holiday.user_id == user.id))
    await session.commit()
