import datetime as dt
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.jalali import numeric_jalali
from app.db.scoped import get_scoped
from app.db.session import get_session
from app.models.teaching import (
    Assessment,
    Grade,
    LessonPlan,
    Period,
    Student,
    Subject,
    TeachingClass,
)
from app.reports.grades import DEFAULT_SCALE, GradeScaleBands, grade_sheet_dataset
from app.reports.pdf import (
    grade_sheet_filename,
    pdf_response,
    render_pdf,
    schedule_filename,
    student_list_filename,
)
from app.reports.schedule import schedule_dataset
from app.reports.students import student_list_dataset

router = APIRouter(prefix="/reports", tags=["reports"])

Session = Annotated[AsyncSession, Depends(get_session)]


def teacher_name(user: CurrentUser) -> str:
    return f"{user.first_name} {user.last_name}".strip()


@router.get("/students/{class_id}.pdf")
async def students_pdf(class_id: UUID, user: CurrentUser, session: Session):
    """Student-list PDF for one owned class. 404 when missing or not owned."""
    teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
    if teaching_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    rows = list(
        await session.scalars(
            select(Student)
            .where(Student.user_id == user.id, Student.class_id == class_id)
            .order_by(Student.last_name, Student.first_name)
        )
    )
    today = dt.datetime.now(dt.UTC).date()
    dataset = student_list_dataset(
        [(s.first_name, s.last_name) for s in rows],
        teacher_name=teacher_name(user),
        class_name=teaching_class.name,
    )
    return pdf_response(
        render_pdf("student-list", dataset),
        student_list_filename(teaching_class.name, today),
    )


@router.get("/grades/{subject_id}.pdf")
async def grades_pdf(
    subject_id: UUID,
    user: CurrentUser,
    session: Session,
    class_id: UUID | None = None,
):
    """Grade-sheet PDF for one owned subject, optionally narrowed to a class.

    404 when the subject is missing/not owned; 422 when the class is missing,
    not owned, or not linked to the subject in settings.
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
    student_stmt = select(Student).where(Student.user_id == user.id)
    class_name = "همه کلاس‌ها"
    if class_id is not None:
        teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
        if teaching_class is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown class_id")
        from app.models.teaching import ClassSubject

        link = await session.scalar(
            select(ClassSubject).where(
                ClassSubject.user_id == user.id,
                ClassSubject.class_id == class_id,
                ClassSubject.subject_id == subject_id,
            )
        )
        if link is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Unknown class_id/subject_id pair",
            )
        student_stmt = student_stmt.where(Student.class_id == class_id)
        class_name = teaching_class.name
    students_rows = list(
        await session.scalars(student_stmt.order_by(Student.last_name, Student.first_name))
    )
    names = [f"{s.first_name} {s.last_name}" for s in students_rows]
    titles = [a.title for a in assessments_rows]
    cells: dict[tuple[str, str], float] = {}
    if assessments_rows and students_rows:
        grades_rows = list(
            await session.scalars(
                select(Grade).where(
                    Grade.user_id == user.id,
                    Grade.student_id.in_([s.id for s in students_rows]),
                    Grade.assessment_id.in_([a.id for a in assessments_rows]),
                )
            )
        )
        by_id = {(str(g.student_id), str(g.assessment_id)): float(g.value) for g in grades_rows}
        id_by_name = {f"{s.first_name} {s.last_name}": str(s.id) for s in students_rows}
        id_by_title = {a.title: str(a.id) for a in assessments_rows}
        cells = {
            (name, title): by_id[(id_by_name[name], id_by_title[title])]
            for name in names
            for title in titles
            if (id_by_name[name], id_by_title[title]) in by_id
        }
    from app.models.teaching import SubjectGradeScale

    scale_row = await session.scalar(
        select(SubjectGradeScale).where(
            SubjectGradeScale.user_id == user.id,
            SubjectGradeScale.subject_id == subject_id,
        )
    )
    scale = (
        GradeScaleBands(
            excellent_min=float(scale_row.excellent_min),
            good_min=float(scale_row.good_min),
            pass_min=float(scale_row.pass_min),
            excellent_label=scale_row.excellent_label,
            good_label=scale_row.good_label,
            fair_label=scale_row.fair_label,
            needs_label=scale_row.needs_label,
        )
        if scale_row is not None
        else DEFAULT_SCALE
    )
    today = dt.datetime.now(dt.UTC).date()
    dataset = grade_sheet_dataset(
        names,
        titles,
        cells,
        teacher_name=teacher_name(user),
        subject_name=subject.name,
        class_name=class_name,
        scale=scale,
        numeric=user.grading_mode != "descriptive",
    )
    return pdf_response(
        render_pdf("grade-sheet", dataset),
        grade_sheet_filename(subject.name, class_name, today),
    )


@router.get("/schedule.pdf")
async def schedule_pdf(
    user: CurrentUser,
    session: Session,
    date_from: Annotated[dt.date, Query()],
    date_to: Annotated[dt.date, Query()],
):
    """Schedule PDF for an owned date range (≤ 31 days). No body, no names."""
    if date_to < date_from or (date_to - date_from).days > 30:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Bad date range")
    plans = list(
        await session.scalars(
            select(LessonPlan)
            .where(
                LessonPlan.user_id == user.id,
                LessonPlan.date >= date_from,
                LessonPlan.date <= date_to,
            )
            .order_by(LessonPlan.date)
        )
    )
    classes = {
        str(c.id): c.name
        for c in await session.scalars(
            select(TeachingClass).where(TeachingClass.user_id == user.id)
        )
    }
    subjects = {
        str(s.id): s.name
        for s in await session.scalars(select(Subject).where(Subject.user_id == user.id))
    }
    periods = {
        str(p.id): p for p in await session.scalars(select(Period).where(Period.user_id == user.id))
    }
    by_day: dict[str, list[tuple[str, str, str, str, str]]] = {}
    day = date_from
    while day <= date_to:
        by_day[day.isoformat()] = []
        day += dt.timedelta(days=1)
    for plan in plans:
        period = periods.get(str(plan.period_id))
        start = plan.start_time or (period.start_time if period else None)
        end = plan.end_time or (period.end_time if period else None)
        timerange = (
            f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}"
            if start and end
            else (start.strftime("%H:%M") if start else "")
        )
        by_day[plan.date.isoformat()].append(
            (
                plan.activity,
                classes.get(str(plan.class_id), "—"),
                subjects.get(str(plan.subject_id), "—"),
                period.label if period else "—",
                timerange,
            )
        )
    dataset = schedule_dataset(
        [(iso, by_day[iso]) for iso in sorted(by_day)],
        teacher_name=teacher_name(user),
        range_label=f"{numeric_jalali(date_from)} تا {numeric_jalali(date_to)}",
    )
    return pdf_response(
        render_pdf("schedule", dataset),
        schedule_filename(date_from, date_to),
    )
