import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import build_crud_router
from app.db.scoped import get_scoped
from app.models.teaching import Holiday, LessonPlan, Period, Subject, TeachingClass
from app.schemas.teaching import (
    ClassCreate,
    ClassOut,
    ClassUpdate,
    HolidayCreate,
    HolidayOut,
    HolidayUpdate,
    LessonPlanCreate,
    LessonPlanOut,
    LessonPlanUpdate,
    PeriodCreate,
    PeriodOut,
    PeriodUpdate,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
)

# ── OWNERSHIP VALIDATION ───────────────────────────────────

_REF_FIELDS: dict[str, type] = {
    "class_id": TeachingClass,
    "subject_id": Subject,
    "period_id": Period,
}


async def _validate_refs(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: dict[str, Any],
    _existing_id: uuid.UUID | None,
) -> None:
    """Reject references to rows the caller does not own.

    A foreign key alone would accept any UUID in the table, which would let one
    teacher attach plans to another teacher's classes.
    """
    for field, model in _REF_FIELDS.items():
        ref = data.get(field)
        if ref is None:
            continue
        if await get_scoped(session, model, ref, user_id) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown {field}")


# ── ROUTERS ────────────────────────────────────────────────

classes = build_crud_router(
    model=TeachingClass,
    create_schema=ClassCreate,
    update_schema=ClassUpdate,
    out_schema=ClassOut,
    prefix="/classes",
    tag="classes",
)

subjects = build_crud_router(
    model=Subject,
    create_schema=SubjectCreate,
    update_schema=SubjectUpdate,
    out_schema=SubjectOut,
    prefix="/subjects",
    tag="subjects",
)

periods = build_crud_router(
    model=Period,
    create_schema=PeriodCreate,
    update_schema=PeriodUpdate,
    out_schema=PeriodOut,
    prefix="/periods",
    tag="periods",
)

lesson_plans = build_crud_router(
    model=LessonPlan,
    create_schema=LessonPlanCreate,
    update_schema=LessonPlanUpdate,
    out_schema=LessonPlanOut,
    prefix="/lesson-plans",
    tag="lesson-plans",
    validate=_validate_refs,
    date_column=LessonPlan.date,
)

# user_id IS NULL rows are seeded official holidays: read-only for every user.
holidays = build_crud_router(
    model=Holiday,
    create_schema=HolidayCreate,
    update_schema=HolidayUpdate,
    out_schema=HolidayOut,
    prefix="/holidays",
    tag="holidays",
    extra_where=lambda _user_id: Holiday.user_id.is_(None),
    date_column=Holiday.date,
)

all_routers: list[APIRouter] = [classes, subjects, periods, lesson_plans, holidays]
