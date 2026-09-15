"""Schedule report dataset: pure builder over domain rows."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ScheduleDataset:
    title: str
    teacher_name: str
    range_label: str
    days: list[tuple[str, list[tuple[str, str, str, str, str]]]]
    # (day_label, [(activity, class_name, subject_name, period_label, time_range)])


def schedule_dataset(
    days: list[tuple[str, list[tuple[str, str, str, str, str]]]],
    *,
    teacher_name: str = "",
    range_label: str,
) -> ScheduleDataset:
    """Build the printable schedule. Empty days render as a holiday/empty row."""
    return ScheduleDataset(
        title="طرح درس",
        teacher_name=teacher_name,
        range_label=range_label,
        days=list(days),
    )
