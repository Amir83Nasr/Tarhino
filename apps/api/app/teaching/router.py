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
from app.reports.grades import (
    DEFAULT_SCALE,
    GradeScaleBands,
    describe_level,
    value_for_level_label,
)
from app.schemas.teaching import (
    AssessmentCreate,
    AssessmentOut,
    AssessmentUpdate,
    ClassCreate,
    ClassOut,
    ClassSubjectCreate,
    ClassSubjectOut,
    ClassUpdate,
    GradeCreate,
    GradeOut,
    GradeScaleCreate,
    GradeScaleOut,
    GradeScaleUpdate,
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


# ── LINK VALIDATION ────────────────────────────────────────


async def _require_link(
    session: AsyncSession,
    user_id: uuid.UUID,
    class_id: uuid.UUID,
    subject_id: uuid.UUID,
) -> None:
    """Reject a class+subject pair the teacher never linked in settings."""
    link = await session.scalar(
        select(ClassSubject).where(
            ClassSubject.user_id == user_id,
            ClassSubject.class_id == class_id,
            ClassSubject.subject_id == subject_id,
        )
    )
    if link is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Unknown class_id/subject_id pair",
        )


def _reject_null(data: dict[str, Any], *fields: str) -> None:
    """Explicit nulls are never a "clear this field": the strict tree has no
    nullable parents, so PATCH {class_id: null} is a 422, not a silent keep."""
    for field in fields:
        if field in data and data[field] is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown {field}")


async def _validate_plan_link(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: dict[str, Any],
    existing_id: uuid.UUID | None,
) -> None:
    """Ownership check, then enforce the strict tree.

    Every plan needs a linked class+subject pair plus a period that belongs to
    the same class. On PATCH the payload may carry only one side, so merge with
    the stored row before checking.
    """
    await _validate_refs(session, user_id, data, existing_id)
    if existing_id is not None:
        _reject_null(data, "class_id", "subject_id", "period_id")
    class_id = data.get("class_id")
    subject_id = data.get("subject_id")
    period_id = data.get("period_id")
    if existing_id is not None and (class_id is None or subject_id is None or period_id is None):
        row = await get_scoped(session, LessonPlan, existing_id, user_id)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        class_id = class_id if class_id is not None else row.class_id
        subject_id = subject_id if subject_id is not None else row.subject_id
        period_id = period_id if period_id is not None else row.period_id
    if class_id is not None and subject_id is not None:
        await _require_link(session, user_id, class_id, subject_id)
    if class_id is not None and period_id is not None:
        period = await get_scoped(session, Period, period_id, user_id)
        if period is None or period.class_id != class_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Unknown class_id/period_id pair",
            )


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


async def _validate_period_scope(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: dict[str, Any],
    existing_id: uuid.UUID | None,
) -> None:
    """Ownership check plus next order_index within the class when omitted.

    On PATCH the class side merges with the stored row, so a label rename never
    silently moves a bell into another class.
    """
    await _validate_refs(session, user_id, data, existing_id)
    if existing_id is not None:
        _reject_null(data, "class_id")
    class_id = data.get("class_id")
    if existing_id is not None and class_id is None:
        row = await get_scoped(session, Period, existing_id, user_id)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        class_id = row.class_id
    if data.get("order_index") is None and class_id is not None:
        highest = await session.scalar(
            select(Period.order_index)
            .where(
                Period.user_id == user_id,
                Period.class_id == class_id,
            )
            .order_by(Period.order_index.desc())
            .limit(1)
        )
        data["order_index"] = (highest or 0) + 1 if highest is not None else 0


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


async def _validate_grade(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: dict[str, Any],
    existing_id: uuid.UUID | None,
) -> None:
    """Ownership check, then stamp the subject-scale label on every write.

    The generic CRUD path must label rows exactly like /upsert: resolve the
    value + assessment (merging stored row on PATCH) and describe it under
    the assessment's subject scale.
    """
    await _validate_refs(session, user_id, data, existing_id)
    assessment_id = data.get("assessment_id")
    value = data.get("value")
    if existing_id is not None and (assessment_id is None or value is None):
        row = await get_scoped(session, Grade, existing_id, user_id)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        assessment_id = assessment_id if assessment_id is not None else row.assessment_id
        value = value if value is not None else float(row.value)
    if assessment_id is None or value is None:
        return
    assessment = await get_scoped(session, Assessment, assessment_id, user_id)
    if assessment is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown assessment_id")
    scale_row = await _scale_for_subject(session, user_id, assessment.subject_id)
    data["label"] = describe_level(float(value), _scale_bands(scale_row))


grades = build_crud_router(
    model=Grade,
    create_schema=GradeCreate,
    update_schema=GradeUpdate,
    out_schema=GradeOut,
    prefix="/grades",
    tag="grades",
    validate=_validate_grade,
)


def _scale_bands(row: SubjectGradeScale | None) -> GradeScaleBands:
    """DB row → pure bands; missing row means the teacher never customized."""
    if row is None:
        return DEFAULT_SCALE
    return GradeScaleBands(
        excellent_min=float(row.excellent_min),
        good_min=float(row.good_min),
        pass_min=float(row.pass_min),
        excellent_label=row.excellent_label,
        good_label=row.good_label,
        fair_label=row.fair_label,
        needs_label=row.needs_label,
    )


async def _scale_for_subject(
    session: AsyncSession, user_id: uuid.UUID, subject_id: uuid.UUID
) -> SubjectGradeScale | None:
    return await session.scalar(
        select(SubjectGradeScale).where(
            SubjectGradeScale.user_id == user_id,
            SubjectGradeScale.subject_id == subject_id,
        )
    )


async def _validate_scale(
    session: AsyncSession,
    user_id: uuid.UUID,
    data: dict[str, Any],
    _existing_id: uuid.UUID | None,
) -> None:
    """Ownership check on subject_id; PATCH merges thresholds before ordering check."""
    await _validate_refs(session, user_id, data, _existing_id)
    if _existing_id is None and data.get("subject_id") is not None:
        dup = await _scale_for_subject(session, user_id, data["subject_id"])
        if dup is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Scale already exists for this subject")
    if _existing_id is not None:
        row = await get_scoped(session, SubjectGradeScale, _existing_id, user_id)
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        merged = {
            "excellent_min": data.get("excellent_min", float(row.excellent_min)),
            "good_min": data.get("good_min", float(row.good_min)),
            "pass_min": data.get("pass_min", float(row.pass_min)),
        }
        mins = [float(merged[k]) for k in ("pass_min", "good_min", "excellent_min")]
        if not (mins[0] < mins[1] < mins[2]):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "thresholds must descend: pass < good < excellent",
            )


grade_scales = build_crud_router(
    model=SubjectGradeScale,
    create_schema=GradeScaleCreate,
    update_schema=GradeScaleUpdate,
    out_schema=GradeScaleOut,
    prefix="/grade-scales",
    tag="grade-scales",
    validate=_validate_scale,
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
    validate=_validate_period_scope,
)

lesson_plans = build_crud_router(
    model=LessonPlan,
    create_schema=LessonPlanCreate,
    update_schema=LessonPlanUpdate,
    out_schema=LessonPlanOut,
    prefix="/lesson-plans",
    tag="lesson-plans",
    validate=_validate_plan_link,
    date_column=LessonPlan.date,
)

class_subjects = build_crud_router(
    model=ClassSubject,
    create_schema=ClassSubjectCreate,
    update_schema=ClassSubjectCreate,
    out_schema=ClassSubjectOut,
    prefix="/class-subjects",
    tag="class-subjects",
    validate=_validate_refs,
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
            await _validate_plan_link(session, user.id, data, None)
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

    Both sides are ownership-checked, then the assessment's subject must be
    linked to the student's class in settings.
    """
    student = await get_scoped(session, Student, payload.student_id, user.id)
    assessment = await get_scoped(session, Assessment, payload.assessment_id, user.id)
    if student is None or assessment is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown reference")
    await _require_link(session, user.id, student.class_id, assessment.subject_id)
    existing = await session.scalar(
        select(Grade).where(
            Grade.user_id == user.id,
            Grade.student_id == payload.student_id,
            Grade.assessment_id == payload.assessment_id,
        )
    )
    scale = _scale_bands(await _scale_for_subject(session, user.id, assessment.subject_id))
    # Numeric mode takes value (label derived); descriptive mode takes level
    # (value mapped). Each mode rejects the other mode's field.
    if user.grading_mode == "descriptive":
        if payload.level is None or payload.value is not None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Descriptive mode takes level"
            )
        try:
            value = value_for_level_label(payload.level, scale)
        except ValueError:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown level") from None
        label = payload.level
    else:
        if payload.value is None or payload.level is not None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Numeric mode takes value")
        value = float(payload.value)
        label = describe_level(value, scale)
    if existing is None:
        existing = Grade(
            id=uuid.uuid4(),
            user_id=user.id,
            student_id=payload.student_id,
            assessment_id=payload.assessment_id,
            value=value,
            label=label,
        )
        session.add(existing)
    else:
        existing.value = value
        existing.label = label
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


@class_subjects.get("/by-class/{class_id}", response_model=list[ClassSubjectOut])
async def class_subjects_by_class(
    class_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ClassSubject]:
    teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
    if teaching_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return list(
        await session.scalars(
            select(ClassSubject).where(
                ClassSubject.user_id == user.id, ClassSubject.class_id == class_id
            )
        )
    )


@periods.get("/by-class/{class_id}", response_model=list[PeriodOut])
async def periods_by_class(
    class_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[Period]:
    teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
    if teaching_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return list(
        await session.scalars(
            select(Period)
            .where(Period.user_id == user.id, Period.class_id == class_id)
            .order_by(Period.order_index, Period.updated_at)
        )
    )


@class_subjects.get("/by-subject/{subject_id}", response_model=list[ClassSubjectOut])
async def class_subjects_by_subject(
    subject_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ClassSubject]:
    subject = await get_scoped(session, Subject, subject_id, user.id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return list(
        await session.scalars(
            select(ClassSubject).where(
                ClassSubject.user_id == user.id,
                ClassSubject.subject_id == subject_id,
            )
        )
    )


@grade_scales.get("/by-subject/{subject_id}", response_model=GradeScaleOut)
async def grade_scale_by_subject(
    subject_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SubjectGradeScale:
    """The subject's scale, or a transient default when never customized.

    Not persisted on read: the row is created on the first PATCH/POST instead,
    so listing subjects never writes.
    """
    subject = await get_scoped(session, Subject, subject_id, user.id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    row = await _scale_for_subject(session, user.id, subject_id)
    if row is not None:
        return row
    return SubjectGradeScale(
        id=uuid.uuid4(),
        user_id=user.id,
        subject_id=subject_id,
        excellent_min=DEFAULT_SCALE.excellent_min,
        good_min=DEFAULT_SCALE.good_min,
        pass_min=DEFAULT_SCALE.pass_min,
        excellent_label=DEFAULT_SCALE.excellent_label,
        good_label=DEFAULT_SCALE.good_label,
        fair_label=DEFAULT_SCALE.fair_label,
        needs_label=DEFAULT_SCALE.needs_label,
    )


@grade_scales.post("/by-subject/{subject_id}/relabel", response_model=int)
async def relabel_subject_grades(
    subject_id: uuid.UUID,
    user: CurrentUser,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> int:
    """Recompute stored grade labels from the subject's current scale."""
    subject = await get_scoped(session, Subject, subject_id, user.id)
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    bands = _scale_bands(await _scale_for_subject(session, user.id, subject_id))
    rows = list(
        await session.scalars(
            select(Grade).where(
                Grade.user_id == user.id,
                Grade.assessment_id.in_(
                    select(Assessment.id).where(
                        Assessment.user_id == user.id,
                        Assessment.subject_id == subject_id,
                    )
                ),
            )
        )
    )
    for row in rows:
        row.label = describe_level(float(row.value), bands)
    await session.commit()
    return len(rows)


all_routers: list[APIRouter] = [
    schools,
    classes,
    students,
    subjects,
    class_subjects,
    assessments,
    grades,
    grade_scales,
    periods,
    lesson_plans,
    holidays,
]
