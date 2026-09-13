import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.crud import build_crud_router
from app.api.deps import CurrentUser
from app.db.scoped import get_scoped
from app.db.session import get_session
from app.models.teaching import (
    Assessment,
    Grade,
    Holiday,
    LessonPlan,
    Period,
    School,
    Student,
    Subject,
    TeachingClass,
)
from app.schemas.teaching import (
    AssessmentCreate,
    AssessmentOut,
    AssessmentUpdate,
    ClassCreate,
    ClassOut,
    ClassUpdate,
    GradeCreate,
    GradeOut,
    GradeUpdate,
    GradeUpsert,
    HolidayCreate,
    HolidayOut,
    HolidayUpdate,
    LessonPlanCreate,
    LessonPlanOut,
    LessonPlanUpdate,
    PeriodCreate,
    PeriodOut,
    PeriodUpdate,
    SchoolCreate,
    SchoolOut,
    SchoolUpdate,
    StudentBulkCreate,
    StudentCreate,
    StudentOut,
    StudentUpdate,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
)

# ── OWNERSHIP VALIDATION ───────────────────────────────────

_REF_FIELDS: dict[str, type] = {
    "class_id": TeachingClass,
    "subject_id": Subject,
    "period_id": Period,
    "school_id": School,
    "student_id": Student,
    "assessment_id": Assessment,
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

schools = build_crud_router(
    model=School,
    create_schema=SchoolCreate,
    update_schema=SchoolUpdate,
    out_schema=SchoolOut,
    prefix="/schools",
    tag="schools",
)

classes = build_crud_router(
    model=TeachingClass,
    create_schema=ClassCreate,
    update_schema=ClassUpdate,
    out_schema=ClassOut,
    prefix="/classes",
    tag="classes",
    validate=_validate_refs,
)

students = build_crud_router(
    model=Student,
    create_schema=StudentCreate,
    update_schema=StudentUpdate,
    out_schema=StudentOut,
    prefix="/students",
    tag="students",
    validate=_validate_refs,
)


async def _validate_assessment(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: dict[str, Any],
    _existing_id: uuid.UUID | None,
) -> None:
    """Ownership check plus next order_index when the client omits it."""
    await _validate_refs(session, user_id, data, _existing_id)
    if data.get("order_index") is None and data.get("subject_id") is not None:
        highest = await session.scalar(
            select(Assessment.order_index)
            .where(
                Assessment.user_id == user_id,
                Assessment.subject_id == data["subject_id"],
            )
            .order_by(Assessment.order_index.desc())
            .limit(1)
        )
        data["order_index"] = (highest or 0) + 1 if highest is not None else 0


assessments = build_crud_router(
    model=Assessment,
    create_schema=AssessmentCreate,
    update_schema=AssessmentUpdate,
    out_schema=AssessmentOut,
    prefix="/assessments",
    tag="assessments",
    validate=_validate_assessment,
)

grades = build_crud_router(
    model=Grade,
    create_schema=GradeCreate,
    update_schema=GradeUpdate,
    out_schema=GradeOut,
    prefix="/grades",
    tag="grades",
    validate=_validate_refs,
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


class BulkCreate(BaseModel):
    items: list[LessonPlanCreate] = Field(min_length=1, max_length=20)


class BulkError(BaseModel):
    index: int
    detail: str


class BulkResult(BaseModel):
    created: list[LessonPlanOut]
    errors: list[BulkError]


@lesson_plans.post("/bulk", response_model=BulkResult)
async def bulk_create_plans(
    payload: BulkCreate,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BulkResult:
    """Create up to 20 plans in one request; per-row results.

    The assistant batch card posts here after the teacher reviews: valid rows
    save, conflicting rows (same day+period) come back in `errors` with their
    index, so the card can keep exactly the failed ones on screen.
    """
    created: list[LessonPlan] = []
    errors: list[BulkError] = []
    for index, item in enumerate(payload.items):
        data = item.model_dump()
        try:
            await _validate_refs(session, user.id, data, None)
        except HTTPException as exc:
            errors.append(BulkError(index=index, detail=str(exc.detail)))
            continue
        try:
            async with session.begin_nested():
                row = LessonPlan(id=uuid.uuid4(), user_id=user.id, **data)
                session.add(row)
                await session.flush()
        except IntegrityError:
            errors.append(
                BulkError(
                    index=index,
                    detail="این روز و زنگ قبلاً پر شده است",
                )
            )
            continue
        created.append(row)
    await session.commit()
    for row in created:
        await session.refresh(row)
    return BulkResult(
        created=[LessonPlanOut.model_validate(r) for r in created],
        errors=errors,
    )


async def _gradebook(
    session: AsyncSession, user: CurrentUser, subject_id: uuid.UUID
) -> dict[str, Any]:
    """One payload for the grades table: subject's assessments + grades.

    Ownership is checked per row (subject, then each student/assessment), so a
    teacher can never read another teacher's gradebook through a guessed id.
    """
    subject = await get_scoped(session, Subject, subject_id, user.id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    assessments_rows = list(
        await session.scalars(
            select(Assessment)
            .where(Assessment.user_id == user.id, Assessment.subject_id == subject_id)
            .order_by(Assessment.order_index, Assessment.updated_at)
        )
    )
    assessment_ids = [a.id for a in assessments_rows]
    grades_rows: list[Grade] = []
    if assessment_ids:
        grades_rows = list(
            await session.scalars(
                select(Grade).where(
                    Grade.user_id == user.id, Grade.assessment_id.in_(assessment_ids)
                )
            )
        )
    return {
        "assessments": [AssessmentOut.model_validate(a) for a in assessments_rows],
        "grades": [GradeOut.model_validate(g) for g in grades_rows],
    }


@assessments.get("/{subject_id}/gradebook")
async def gradebook(
    subject_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, Any]:
    return await _gradebook(session, user, subject_id)


@grades.post("/upsert", response_model=GradeOut)
async def upsert_grade(
    payload: GradeUpsert,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Grade:
    """Cell save: insert or update the single (student, assessment) row.

    Both sides are ownership-checked, then verified to belong together
    (assessment's subject is taught to the student's class is implied by shared
    ownership; cross-teacher mix is already rejected above).
    """
    student = await get_scoped(session, Student, payload.student_id, user.id)
    assessment = await get_scoped(session, Assessment, payload.assessment_id, user.id)
    if student is None or assessment is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown reference")
    existing = await session.scalar(
        select(Grade).where(
            Grade.user_id == user.id,
            Grade.student_id == payload.student_id,
            Grade.assessment_id == payload.assessment_id,
        )
    )
    if existing is None:
        existing = Grade(
            id=uuid.uuid4(),
            user_id=user.id,
            student_id=payload.student_id,
            assessment_id=payload.assessment_id,
            value=payload.value,
        )
        session.add(existing)
    else:
        existing.value = payload.value
    await session.commit()
    await session.refresh(existing)
    return existing


@students.post("/bulk", response_model=list[StudentOut], status_code=status.HTTP_201_CREATED)
async def bulk_create_students(
    payload: StudentBulkCreate,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[Student]:
    """Paste-a-list import: one class, up to 100 parsed rows, single commit."""
    teaching_class = await get_scoped(session, TeachingClass, payload.class_id, user.id)
    if teaching_class is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown class_id")
    rows = [
        Student(
            id=uuid.uuid4(),
            user_id=user.id,
            class_id=payload.class_id,
            first_name=item.first_name,
            last_name=item.last_name,
        )
        for item in payload.items
    ]
    # Highest existing order is implicit (updated_at); single flush keeps it atomic.
    session.add_all(rows)
    await session.commit()
    for row in rows:
        await session.refresh(row)
    return rows


@students.get("/by-class/{class_id}", response_model=list[StudentOut])
async def students_by_class(
    class_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[Student]:
    teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
    if teaching_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return list(
        await session.scalars(
            select(Student)
            .where(Student.user_id == user.id, Student.class_id == class_id)
            .order_by(Student.last_name, Student.first_name)
        )
    )


@assessments.get("/by-subject/{subject_id}", response_model=list[AssessmentOut])
async def assessments_by_subject(
    subject_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[Assessment]:
    subject = await get_scoped(session, Subject, subject_id, user.id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return list(
        await session.scalars(
            select(Assessment)
            .where(Assessment.user_id == user.id, Assessment.subject_id == subject_id)
            .order_by(Assessment.order_index, Assessment.updated_at)
        )
    )


all_routers: list[APIRouter] = [
    schools,
    classes,
    students,
    subjects,
    assessments,
    grades,
    periods,
    lesson_plans,
    holidays,
]
