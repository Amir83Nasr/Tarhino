"""Schedule report dataset: pure builder over domain rows."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ScheduleDataset:
    title: str
    teacher_name: str
    range_label: str
    days: list[tuple[str, list[tuple[str, str, str]]]]
    # (day_label, [(period_label, subject_name, activity)])
    school_name: str = ""
    class_name: str = ""
    academic_year: str = ""


def schedule_dataset(
    days: list[tuple[str, list[tuple[str, str, str]]]],
    *,
    teacher_name: str = "",
    range_label: str,
    school_name: str = "",
    class_name: str = "",
    academic_year: str = "",
) -> ScheduleDataset:
    """Build the printable schedule. Empty days render as a holiday/empty row."""
    return ScheduleDataset(
        title="طرح درس هفتگی و روزانه",
        teacher_name=teacher_name,
        range_label=range_label,
        days=list(days),
        school_name=school_name,
        class_name=class_name,
        academic_year=academic_year,
    )
