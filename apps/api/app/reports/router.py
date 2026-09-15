import datetime as dt
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.jalali import academic_year_label, numeric_jalali
from app.db.scoped import get_scoped
from app.db.session import get_session
from app.models.teaching import (
    Assessment,
    ClassSubject,
    Grade,
    LessonPlan,
    Period,
    School,
    Student,
    Subject,
    TeachingClass,
    WeeklySlot,
)
from app.reports.excel import (
    excel_response,
    timetable_excel_filename,
    timetable_excel_html,
)
from app.reports.grades import DEFAULT_SCALE, grade_sheet_dataset
from app.reports.pdf import (
    grade_sheet_filename,
    pdf_response,
    render_pdf,
    report_card_filename,
    schedule_filename,
    student_list_filename,
    timetable_filename,
)
from app.reports.report_card import build_student_card, report_card_dataset
from app.reports.schedule import schedule_dataset
from app.reports.students import student_list_dataset
from app.reports.timetable import timetable_dataset

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
    scale = DEFAULT_SCALE
    today = dt.datetime.now(dt.UTC).date()
    dataset = grade_sheet_dataset(
        names,
        titles,
        cells,
        teacher_name=teacher_name(user),
        subject_name=subject.name,
        class_name=class_name,
        scale=scale,
        numeric=False,
    )
    return pdf_response(
        render_pdf("grade-sheet", dataset),
        grade_sheet_filename(subject.name, class_name, today),
    )


async def _report_cards(
    session: AsyncSession,
    user: CurrentUser,
    class_id: UUID,
    student_id: UUID | None,
) -> tuple[object, str]:
    """Shared dataset builder for the single and whole-class report cards.

    Returns (dataset, filename). 404 when the class is missing/not owned;
    422 when the student is unknown or outside this class.
    """
    teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
    if teaching_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    if student_id is not None and await get_scoped(session, Student, student_id, user.id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown student_id")
    student_stmt = (
        select(Student)
        .where(Student.user_id == user.id, Student.class_id == class_id)
        .order_by(Student.last_name, Student.first_name)
    )
    if student_id is not None:
        student_stmt = student_stmt.where(Student.id == student_id)
    students_rows = list(await session.scalars(student_stmt))
    if student_id is not None and not students_rows:
        # Owned but enrolled in another class: same 422 as an unlinked pair.
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown student_id")
    links = list(
        await session.scalars(
            select(ClassSubject).where(
                ClassSubject.user_id == user.id,
                ClassSubject.class_id == class_id,
            )
        )
    )
    if not links:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No subjects for class")
    subjects_by_id = {
        s.id: s
        for s in await session.scalars(
            select(Subject).where(
                Subject.user_id == user.id,
                Subject.id.in_([link.subject_id for link in links]),
            )
        )
    }
    # Linked subjects whose catalog row was deleted: skip, keep order stable.
    linked_subject_ids = [link.subject_id for link in links if link.subject_id in subjects_by_id]
    assessments_rows = (
        list(
            await session.scalars(
                select(Assessment)
                .where(
                    Assessment.user_id == user.id,
                    Assessment.subject_id.in_(linked_subject_ids),
                )
                .order_by(Assessment.order_index, Assessment.updated_at)
            )
        )
        if linked_subject_ids
        else []
    )
    grades_by_student_subject: dict[tuple[str, str], list[float]] = {}
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
        subject_of_assessment = {str(a.id): str(a.subject_id) for a in assessments_rows}
        for grade in grades_rows:
            key = (str(grade.student_id), subject_of_assessment[str(grade.assessment_id)])
            grades_by_student_subject.setdefault(key, []).append(float(grade.value))
    numeric = False
    cards = [
        build_student_card(
            f"{student.first_name} {student.last_name}",
            [
                (
                    subjects_by_id[subject_id].name,
                    grades_by_student_subject.get((str(student.id), str(subject_id)), []),
                    DEFAULT_SCALE,
                )
                for subject_id in linked_subject_ids
            ],
            numeric=numeric,
        )
        for student in students_rows
    ]
    dataset = report_card_dataset(
        cards,
        teacher_name=teacher_name(user),
        class_name=teaching_class.name,
        numeric=numeric,
    )
    today = dt.datetime.now(dt.UTC).date()
    if student_id is not None:
        (student,) = students_rows
        name = f"{student.first_name} {student.last_name}"
        return dataset, report_card_filename(teaching_class.name, today, name)
    return dataset, report_card_filename(teaching_class.name, today)


@router.get("/report-cards/{class_id}.pdf")
async def class_report_cards_pdf(class_id: UUID, user: CurrentUser, session: Session):
    """Whole-class report card: one page per student, all subjects averaged."""
    dataset, filename = await _report_cards(session, user, class_id, None)
    return pdf_response(render_pdf("report-card", dataset), filename)


@router.get("/report-cards/{class_id}/{student_id}.pdf")
async def student_report_card_pdf(
    class_id: UUID, student_id: UUID, user: CurrentUser, session: Session
):
    """Single-student report card: one student's averages across subjects."""
    dataset, filename = await _report_cards(session, user, class_id, student_id)
    return pdf_response(render_pdf("report-card", dataset), filename)


@router.get("/schedule.pdf")
async def schedule_pdf(
    user: CurrentUser,
    session: Session,
    date_from: Annotated[dt.date, Query()],
    date_to: Annotated[dt.date, Query()],
    class_id: Annotated[UUID | None, Query()] = None,
):
    """Weekly/daily plan PDF for one owned class (≤ 31 days). 422 on bad range
    or unknown class_id. Filters plans by class; other classes are excluded."""
    if date_to < date_from or (date_to - date_from).days > 30:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Bad date range")
    teaching_class = None
    school_name = ""
    if class_id is not None:
        teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
        if teaching_class is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown class_id")
        school = await get_scoped(session, School, teaching_class.school_id, user.id)
        school_name = school.name if school is not None else ""
    plan_stmt = select(LessonPlan).where(
        LessonPlan.user_id == user.id,
        LessonPlan.date >= date_from,
        LessonPlan.date <= date_to,
    )
    if class_id is not None:
        plan_stmt = plan_stmt.where(LessonPlan.class_id == class_id)
    plans = list(await session.scalars(plan_stmt.order_by(LessonPlan.date)))
    subjects = {
        str(s.id): s.name
        for s in await session.scalars(select(Subject).where(Subject.user_id == user.id))
    }
    periods = {
        str(p.id): p for p in await session.scalars(select(Period).where(Period.user_id == user.id))
    }
    by_day: dict[str, list[tuple[int, str, str, str, str]]] = {}
    day = date_from
    while day <= date_to:
        by_day[day.isoformat()] = []
        day += dt.timedelta(days=1)
    for plan in plans:
        period = periods.get(str(plan.period_id))
        order = period.order_index if period else 10**9
        start = str(period.start_time) if period and period.start_time else ""
        by_day[plan.date.isoformat()].append(
            (
                order,
                start,
                period.label if period else "—",
                subjects.get(str(plan.subject_id), "—"),
                plan.activity,
            )
        )
    days_sorted = [
        (iso, [(label, subject, activity) for _, _, label, subject, activity in sorted(rows)])
        for iso, rows in sorted(by_day.items())
    ]
    dataset = schedule_dataset(
        days_sorted,
        teacher_name=teacher_name(user),
        range_label=f"{numeric_jalali(date_from)} تا {numeric_jalali(date_to)}",
        school_name=school_name,
        class_name=teaching_class.name if teaching_class is not None else "",
        academic_year=academic_year_label(date_from),
    )
    return pdf_response(
        render_pdf("schedule", dataset),
        schedule_filename(date_from, date_to),
    )


# Saturday-first weekday headers for the timetable grid (Sat..Wed only;
# Thursday/Friday are school weekends and never part of the template).
TIMETABLE_WEEKDAYS = ("شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه")


async def _timetable_dataset(
    session: AsyncSession,
    user: CurrentUser,
    class_id: UUID,
) -> tuple[object, str]:
    """Shared dataset builder for the timetable PDF and Excel downloads.

    Returns (dataset, class_name). 404 when missing or not owned.
    """
    from app.core.jalali import format_time as fa_time

    teaching_class = await get_scoped(session, TeachingClass, class_id, user.id)
    if teaching_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    school = await get_scoped(session, School, teaching_class.school_id, user.id)
    school_name = school.name if school is not None else ""
    today = dt.datetime.now(dt.UTC).date()
    periods = list(
        await session.scalars(
            select(Period)
            .where(Period.user_id == user.id, Period.class_id == class_id)
            .order_by(Period.order_index, Period.updated_at)
        )
    )
    slots = list(
        await session.scalars(
            select(WeeklySlot).where(WeeklySlot.user_id == user.id, WeeklySlot.class_id == class_id)
        )
    )
    subjects = {
        str(s.id): s.name
        for s in await session.scalars(select(Subject).where(Subject.user_id == user.id))
    }
    cells = {
        (slot.weekday, str(slot.period_id)): subjects.get(str(slot.subject_id), "—")
        for slot in slots
    }
    dataset = timetable_dataset(
        [
            (
                str(p.id),
                p.label,
                f"{fa_time(p.start_time)} تا {fa_time(p.end_time)}",
            )
            for p in periods
        ],
        cells,
        teacher_name=teacher_name(user),
        class_name=teaching_class.name,
        weekdays=list(TIMETABLE_WEEKDAYS),
        school_name=school_name,
        academic_year=academic_year_label(today),
    )
    return dataset, teaching_class.name


@router.get("/timetable/{class_id}.pdf")
async def timetable_pdf(class_id: UUID, user: CurrentUser, session: Session):
    """Weekly-timetable PDF for one owned class. 404 when missing or not owned."""
    dataset, class_name = await _timetable_dataset(session, user, class_id)
    today = dt.datetime.now(dt.UTC).date()
    return pdf_response(
        render_pdf("timetable", dataset),
        timetable_filename(class_name, today),
    )


@router.get("/timetable/{class_id}.xls")
async def timetable_xls(class_id: UUID, user: CurrentUser, session: Session):
    """Weekly-timetable Excel grid for one owned class. 404 when missing/not owned."""
    dataset, class_name = await _timetable_dataset(session, user, class_id)
    today = dt.datetime.now(dt.UTC).date()
    return excel_response(
        timetable_excel_html(dataset),
        timetable_excel_filename(class_name, today),
    )
