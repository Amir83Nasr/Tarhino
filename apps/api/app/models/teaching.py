import datetime as dt
import uuid

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Time,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserScoped(Base):
    """Base for user-owned rows: UUID pk, ownership, timestamps."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class School(UserScoped):
    __tablename__ = "schools"

    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(32), default=None)


class TeachingClass(UserScoped):
    """A class always belongs to a school (strict tree: school -> class).

    One class per teacher: shift picks which bell set is active. `rotating`
    alternates morning/afternoon each week around `shift_anchor` (a Saturday).
    """

    __tablename__ = "classes"

    name: Mapped[str] = mapped_column(String(100))
    grade: Mapped[str | None] = mapped_column(String(100), default=None)
    color: Mapped[str | None] = mapped_column(String(32), default=None)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"))
    shift: Mapped[str] = mapped_column(String(16), default="morning")
    shift_anchor: Mapped[dt.date | None] = mapped_column(Date, default=None)

    @property
    def active_shift(self) -> str:
        """Bell set active this week (rotating alternates around the anchor)."""
        from datetime import UTC, datetime

        from app.teaching.elementary import effective_shift

        today = datetime.now(UTC).date()
        return effective_shift(self.shift or "morning", self.shift_anchor, today)


class Student(UserScoped):
    """A student belongs to a class, not to a subject."""

    __tablename__ = "students"
    __table_args__ = (Index("ix_students_user_class", "user_id", "class_id"),)

    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), index=True
    )
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))


class Subject(UserScoped):
    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(32), default=None)


class ClassSubject(UserScoped):
    """Link: which subjects are taught to which class."""

    __tablename__ = "class_subjects"
    __table_args__ = (
        UniqueConstraint("user_id", "class_id", "subject_id", name="uq_class_subject_cell"),
        Index("ix_class_subjects_user_class", "user_id", "class_id"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), index=True
    )


class Period(UserScoped):
    """One class's bell. Each class holds two 5-bell sets (morning/afternoon)."""

    __tablename__ = "periods"
    __table_args__ = (
        Index("ix_periods_user_order", "user_id", "order_index"),
        Index("ix_periods_user_class_order", "user_id", "class_id", "order_index"),
    )

    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(100))
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)
    order_index: Mapped[int] = mapped_column(Integer)
    shift: Mapped[str] = mapped_column(String(16), default="morning")


class LessonPlan(UserScoped):
    """Strict leaf of the tree: class + subject + period are all required.

    Subjects stay a per-teacher catalog; the class_subjects link says which
    subject is taught to which class. Deleting any ancestor removes the plan.
    """

    __tablename__ = "lesson_plans"
    __table_args__ = (
        Index("ix_lesson_plans_user_date", "user_id", "date"),
        # One plan per (user, date, period); deletes are hard so no exemption needed.
        Index(
            "uq_lesson_plans_active",
            "user_id",
            "date",
            "period_id",
            unique=True,
        ),
    )

    date: Mapped[dt.date] = mapped_column(Date)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("periods.id", ondelete="CASCADE"))
    start_time: Mapped[dt.time | None] = mapped_column(Time, default=None)
    end_time: Mapped[dt.time | None] = mapped_column(Time, default=None)
    activity: Mapped[str] = mapped_column(String(2000))
    notes: Mapped[str] = mapped_column(String(2000), default="")
    status: Mapped[str] = mapped_column(String(16), default="planned")


class WeeklySlot(UserScoped):
    """One cell of the teacher's fixed weekly timetable: weekday + period.

    Stable across the school year; "ensure-week" copies cells into LessonPlans for a
    concrete week. Same strict tree as LessonPlan (class + linked subject +
    period of that class).
    """

    __tablename__ = "weekly_slots"
    __table_args__ = (
        UniqueConstraint("user_id", "class_id", "weekday", "period_id", name="uq_weekly_slot_cell"),
        Index("ix_weekly_slots_user_class", "user_id", "class_id"),
    )

    # Saturday-first index: 0 = شنبه … 4 = چهارشنبه.
    weekday: Mapped[int] = mapped_column(Integer)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"))
    period_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("periods.id", ondelete="CASCADE"))


class Assessment(UserScoped):
    """A grade column on a subject. weight reserved for future averages."""

    __tablename__ = "assessments"
    __table_args__ = (Index("ix_assessments_user_subject", "user_id", "subject_id"),)

    subject_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(100))
    weight: Mapped[float] = mapped_column(Numeric(6, 2), default=1)
    order_index: Mapped[int] = mapped_column(Integer, default=0)


class Grade(UserScoped):
    """One cell: student × assessment. Unique so a cell holds one value."""

    __tablename__ = "grades"
    __table_args__ = (
        UniqueConstraint("user_id", "student_id", "assessment_id", name="uq_grade_cell"),
        Index("ix_grades_user_assessment", "user_id", "assessment_id"),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[float] = mapped_column(Numeric(5, 2))
    label: Mapped[str] = mapped_column(String(100), default="")


class Holiday(UserScoped):
    """user_id NULL = official/global holiday; otherwise a personal day off."""

    __tablename__ = "holidays"
    __table_args__ = (Index("ix_holidays_user_date", "user_id", "date"),)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), default=None, index=True
    )
    date: Mapped[dt.date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(16))
    description: Mapped[str | None] = mapped_column(String(1000), default=None)
