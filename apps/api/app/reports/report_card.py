"""Per-student report card dataset: one row per subject, not per assessment."""

from dataclasses import dataclass

from app.reports.grades import DEFAULT_SCALE, GradeScaleBands, describe_level, format_grade


@dataclass(frozen=True)
class ReportCardSubjectRow:
    subject_name: str
    average: str | None  # formatted mean; None in descriptive mode or without grades
    level: str | None


@dataclass(frozen=True)
class StudentReportCard:
    student_name: str
    rows: list[ReportCardSubjectRow]
    overall: str | None  # mean of the subject means
    overall_level: str | None


@dataclass(frozen=True)
class ReportCardDataset:
    title: str
    teacher_name: str
    class_name: str
    cards: list[StudentReportCard]
    numeric: bool = True


def build_student_card(
    student_name: str,
    subject_values: list[tuple[str, list[float], GradeScaleBands]],
    *,
    numeric: bool = True,
    overall_scale: GradeScaleBands = DEFAULT_SCALE,
) -> StudentReportCard:
    """One card: each subject's assessment values collapse to a mean + level."""
    rows: list[ReportCardSubjectRow] = []
    means: list[float] = []
    for subject_name, values, scale in subject_values:
        mean = sum(values) / len(values) if values else None
        if mean is not None:
            means.append(mean)
        rows.append(
            ReportCardSubjectRow(
                subject_name=subject_name,
                average=(format_grade(mean) if numeric else None) if mean is not None else None,
                level=describe_level(mean, scale) if mean is not None else None,
            )
        )
    overall = sum(means) / len(means) if means else None
    return StudentReportCard(
        student_name=student_name,
        rows=rows,
        overall=(format_grade(overall) if numeric else None) if overall is not None else None,
        overall_level=describe_level(overall, overall_scale) if overall is not None else None,
    )


def report_card_dataset(
    cards: list[StudentReportCard],
    *,
    teacher_name: str = "",
    class_name: str,
    numeric: bool = True,
) -> ReportCardDataset:
    """One card per student; the class PDF prints each card on its own page."""
    return ReportCardDataset(
        title="کارنامه دانش‌آموز",
        teacher_name=teacher_name,
        class_name=class_name,
        cards=list(cards),
        numeric=numeric,
    )
