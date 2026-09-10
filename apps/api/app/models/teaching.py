import datetime as dt
import uuid

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserScoped(Base):
    """Base for user-owned rows: UUID pk, ownership, timestamps, tombstone."""

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
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class TeachingClass(UserScoped):
    __tablename__ = "classes"

    name: Mapped[str] = mapped_column(String(100))
    grade: Mapped[str | None] = mapped_column(String(100), default=None)
    color: Mapped[str | None] = mapped_column(String(32), default=None)


class Subject(UserScoped):
    __tablename__ = "subjects"

    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(32), default=None)


class Period(UserScoped):
    __tablename__ = "periods"
    __table_args__ = (Index("ix_periods_user_order", "user_id", "order_index"),)

    label: Mapped[str] = mapped_column(String(100))
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)
    order_index: Mapped[int] = mapped_column(Integer)


class LessonPlan(UserScoped):
    __tablename__ = "lesson_plans"
    __table_args__ = (
        Index("ix_lesson_plans_user_date", "user_id", "date"),
        # One active plan per (user, date, period); tombstoned rows are exempt.
        Index(
            "uq_lesson_plans_active",
            "user_id",
            "date",
            "period_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    date: Mapped[dt.date] = mapped_column(Date)
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("classes.id", ondelete="SET NULL"), default=None
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"), default=None
    )
    period_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("periods.id", ondelete="SET NULL"), default=None
    )
    start_time: Mapped[dt.time | None] = mapped_column(Time, default=None)
    end_time: Mapped[dt.time | None] = mapped_column(Time, default=None)
    activity: Mapped[str] = mapped_column(String(2000))
    notes: Mapped[str] = mapped_column(String(2000), default="")
    status: Mapped[str] = mapped_column(String(16), default="planned")


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
