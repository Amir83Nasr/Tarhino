import datetime as dt
import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

LessonStatus = Literal["planned", "done", "cancelled"]
HolidayType = Literal["official", "school", "personal"]


class _ScopedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: dt.datetime
    updated_at: dt.datetime


# ── CLASSES ────────────────────────────────────────────────


class ClassFields(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    grade: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=32)


class ClassCreate(ClassFields):
    pass


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    grade: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=32)


class ClassOut(ClassFields, _ScopedOut):
    pass


# ── SUBJECTS ───────────────────────────────────────────────


class SubjectFields(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=32)


class SubjectCreate(SubjectFields):
    pass


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=32)


class SubjectOut(SubjectFields, _ScopedOut):
    pass


# ── PERIODS ────────────────────────────────────────────────


class PeriodFields(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    start_time: dt.time
    end_time: dt.time

    @model_validator(mode="after")
    def end_after_start(self) -> "PeriodFields":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class PeriodCreate(PeriodFields):
    order_index: int | None = None


class PeriodUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=100)
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    order_index: int | None = None

    @model_validator(mode="after")
    def end_after_start(self) -> "PeriodUpdate":
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError("end_time must be after start_time")
        return self


class PeriodOut(PeriodFields, _ScopedOut):
    order_index: int


# ── LESSON PLANS ───────────────────────────────────────────


class LessonPlanFields(BaseModel):
    date: dt.date
    class_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    period_id: uuid.UUID | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    activity: str = Field(min_length=1, max_length=2000)
    notes: str = Field(default="", max_length=2000)
    status: LessonStatus = "planned"


class LessonPlanCreate(LessonPlanFields):
    pass


class LessonPlanUpdate(BaseModel):
    date: dt.date | None = None
    class_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    period_id: uuid.UUID | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    activity: str | None = Field(default=None, min_length=1, max_length=2000)
    notes: str | None = Field(default=None, max_length=2000)
    status: LessonStatus | None = None


class LessonPlanOut(LessonPlanFields, _ScopedOut):
    pass


# ── HOLIDAYS ───────────────────────────────────────────────


class HolidayFields(BaseModel):
    date: dt.date
    title: str = Field(min_length=1, max_length=200)
    type: HolidayType
    description: str | None = Field(default=None, max_length=1000)


class HolidayCreate(HolidayFields):
    pass


class HolidayUpdate(BaseModel):
    date: dt.date | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    type: HolidayType | None = None
    description: str | None = Field(default=None, max_length=1000)


class HolidayOut(HolidayFields, _ScopedOut):
    pass
