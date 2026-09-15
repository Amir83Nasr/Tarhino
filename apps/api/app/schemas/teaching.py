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


# ── SCHOOLS ────────────────────────────────────────────────


class SchoolFields(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=32)


class SchoolCreate(SchoolFields):
    pass


class SchoolUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=32)


class SchoolOut(SchoolFields, _ScopedOut):
    pass


# ── CLASSES ────────────────────────────────────────────────


class ClassFields(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    grade: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, max_length=32)
    school_id: uuid.UUID
    shift: str = Field(default="morning", min_length=1, max_length=16)
    shift_anchor: dt.date | None = None


class ClassCreate(ClassFields):
    pass


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    grade: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=32)
    school_id: uuid.UUID | None = None
    shift: str | None = Field(default=None, min_length=1, max_length=16)
    shift_anchor: dt.date | None = None


class ClassOut(ClassFields, _ScopedOut):
    # Bell set active this week (same as shift, unless rotating alternates).
    active_shift: str = "morning"


# ── STUDENTS ───────────────────────────────────────────────


class StudentFields(BaseModel):
    class_id: uuid.UUID
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class StudentCreate(StudentFields):
    pass


class StudentUpdate(BaseModel):
    class_id: uuid.UUID | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)


class StudentOut(StudentFields, _ScopedOut):
    pass


class StudentBulkItem(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)


class StudentBulkCreate(BaseModel):
    class_id: uuid.UUID
    items: list[StudentBulkItem] = Field(min_length=1, max_length=100)


# ── ASSESSMENTS ────────────────────────────────────────────


class AssessmentFields(BaseModel):
    subject_id: uuid.UUID
    title: str = Field(min_length=1, max_length=100)
    # ponytail: weight stored now, UI later. Weighted averages read this column
    # without restructuring; API accepts it but nothing forces it yet.
    weight: float = Field(default=1, ge=0, le=100)


class AssessmentCreate(AssessmentFields):
    order_index: int | None = None


class AssessmentUpdate(BaseModel):
    subject_id: uuid.UUID | None = None
    title: str | None = Field(default=None, min_length=1, max_length=100)
    weight: float | None = Field(default=None, ge=0, le=100)
    order_index: int | None = None


class AssessmentOut(AssessmentFields, _ScopedOut):
    order_index: int


# ── GRADES ─────────────────────────────────────────────────

MAX_GRADE = 20


class GradeFields(BaseModel):
    student_id: uuid.UUID
    assessment_id: uuid.UUID
    value: float = Field(ge=0, le=MAX_GRADE)


class GradeCreate(GradeFields):
    pass


class GradeUpdate(BaseModel):
    student_id: uuid.UUID | None = None
    assessment_id: uuid.UUID | None = None
    value: float | None = Field(default=None, ge=0, le=MAX_GRADE)


class GradeOut(GradeFields, _ScopedOut):
    # Server-computed from the default bands at write time; never user input.
    label: str = ""


class GradeUpsert(BaseModel):
    student_id: uuid.UUID
    assessment_id: uuid.UUID
    # Numeric mode sends value; descriptive mode sends level (one of the 4
    # default labels). The server enforces which one applies.
    value: float | None = Field(default=None, ge=0, le=MAX_GRADE)
    level: str | None = Field(default=None, min_length=1, max_length=100)


# ── CLASS-SUBJECT LINKS ────────────────────────────────────


class ClassSubjectFields(BaseModel):
    class_id: uuid.UUID
    subject_id: uuid.UUID


class ClassSubjectCreate(ClassSubjectFields):
    pass


class ClassSubjectOut(ClassSubjectFields, _ScopedOut):
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
    class_id: uuid.UUID
    label: str = Field(min_length=1, max_length=100)
    start_time: dt.time
    end_time: dt.time
    shift: str = Field(default="morning", min_length=1, max_length=16)

    @model_validator(mode="after")
    def end_after_start(self) -> "PeriodFields":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class PeriodCreate(PeriodFields):
    order_index: int | None = None


class PeriodUpdate(BaseModel):
    class_id: uuid.UUID | None = None
    label: str | None = Field(default=None, min_length=1, max_length=100)
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    order_index: int | None = None
    shift: str | None = Field(default=None, min_length=1, max_length=16)

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
    class_id: uuid.UUID
    subject_id: uuid.UUID
    period_id: uuid.UUID
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    # Empty allowed: weekly-template ensure-week creates rows with blank activity
    # for the teacher to fill later; manual creation still requires it (see
    # LessonPlanCreate below).
    activity: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=2000)
    status: LessonStatus = "planned"


class LessonPlanCreate(LessonPlanFields):
    activity: str = Field(min_length=1, max_length=2000)


class LessonPlanUpdate(BaseModel):
    date: dt.date | None = None
    class_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    period_id: uuid.UUID | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    activity: str | None = Field(default=None, max_length=2000)
    notes: str | None = Field(default=None, max_length=2000)
    status: LessonStatus | None = None


class LessonPlanOut(LessonPlanFields, _ScopedOut):
    pass


class WeekEnsure(BaseModel):
    """Auto-fill target: one Saturday-first week of one owned class."""

    class_id: uuid.UUID
    week_start: dt.date


# ── WEEKLY SLOTS (fixed timetable template) ──────────────

# Saturday-first: 0 = شنبه … 4 = چهارشنبه. Thursday/Friday are school
# weekends and never part of the template.
MIN_WEEKDAY = 0
MAX_WEEKDAY = 4


class WeeklySlotFields(BaseModel):
    weekday: int = Field(ge=MIN_WEEKDAY, le=MAX_WEEKDAY)
    class_id: uuid.UUID
    subject_id: uuid.UUID
    period_id: uuid.UUID


class WeeklySlotCreate(WeeklySlotFields):
    pass


class WeeklySlotUpdate(BaseModel):
    weekday: int | None = Field(default=None, ge=MIN_WEEKDAY, le=MAX_WEEKDAY)
    class_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    period_id: uuid.UUID | None = None


class WeeklySlotOut(WeeklySlotFields, _ScopedOut):
    pass


# ── ELEMENTARY SETUP ─────────────────────────────────────────
# One call for grades 1-6: school name + grade + shift derive the teacher's
# single school/class, its subjects and both 5-bell sets server-side.


class ElementarySetupCreate(BaseModel):
    school_name: str = Field(min_length=1, max_length=100)
    name: str | None = Field(default=None, min_length=1, max_length=100)
    grade: str = Field(min_length=1, max_length=100)
    shift: str = Field(default="morning", min_length=1, max_length=16)


class ElementarySetupOut(ClassOut):
    school: SchoolOut
    subjects: list[SubjectOut]
    periods: list[PeriodOut]


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
