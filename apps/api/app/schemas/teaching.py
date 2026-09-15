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
    grade: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=32)
    school_id: uuid.UUID


class ClassCreate(ClassFields):
    pass


class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    grade: str | None = Field(default=None, max_length=100)
    color: str | None = Field(default=None, max_length=32)
    school_id: uuid.UUID | None = None


class ClassOut(ClassFields, _ScopedOut):
    pass


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


# ── GRADE SCALES (per-subject descriptive bands) ───────────

MAX_GRADE = 20


class GradeScaleFields(BaseModel):
    subject_id: uuid.UUID
    excellent_min: float = Field(default=18, ge=0, le=MAX_GRADE)
    good_min: float = Field(default=15, ge=0, le=MAX_GRADE)
    pass_min: float = Field(default=10, ge=0, le=MAX_GRADE)
    excellent_label: str = Field(default="خیلی خوب", min_length=1, max_length=100)
    good_label: str = Field(default="خوب", min_length=1, max_length=100)
    fair_label: str = Field(default="قابل قبول", min_length=1, max_length=100)
    needs_label: str = Field(default="نیازمند تلاش بیشتر", min_length=1, max_length=100)

    @model_validator(mode="after")
    def thresholds_descend(self) -> "GradeScaleFields":
        if not (self.pass_min < self.good_min < self.excellent_min):
            raise ValueError("thresholds must descend: pass < good < excellent")
        return self


class GradeScaleCreate(GradeScaleFields):
    pass


class GradeScaleUpdate(BaseModel):
    excellent_min: float | None = Field(default=None, ge=0, le=MAX_GRADE)
    good_min: float | None = Field(default=None, ge=0, le=MAX_GRADE)
    pass_min: float | None = Field(default=None, ge=0, le=MAX_GRADE)
    excellent_label: str | None = Field(default=None, min_length=1, max_length=100)
    good_label: str | None = Field(default=None, min_length=1, max_length=100)
    fair_label: str | None = Field(default=None, min_length=1, max_length=100)
    needs_label: str | None = Field(default=None, min_length=1, max_length=100)

    @model_validator(mode="after")
    def thresholds_descend(self) -> "GradeScaleUpdate":
        mins = [self.pass_min, self.good_min, self.excellent_min]
        if all(m is not None for m in mins) and not (
            self.pass_min < self.good_min < self.excellent_min  # type: ignore[operator]
        ):
            raise ValueError("thresholds must descend: pass < good < excellent")
        return self


class GradeScaleOut(GradeScaleFields, _ScopedOut):
    pass


# ── GRADES ─────────────────────────────────────────────────


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
    # Server-computed from the subject's scale at write time; never user input.
    label: str = ""


class GradeUpsert(BaseModel):
    student_id: uuid.UUID
    assessment_id: uuid.UUID
    # Numeric mode sends value; descriptive mode sends level (one of the
    # subject scale's 4 labels). The server enforces which one applies.
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
