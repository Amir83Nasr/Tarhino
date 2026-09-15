"""Timetable report dataset: pure builder over template rows."""

from dataclasses import dataclass


@dataclass(frozen=True)
class TimetableRow:
    period_label: str
    time_range: str
    # One subject name per weekday (Sat..Wed), None when the cell is empty.
    cells: list[str | None]


@dataclass(frozen=True)
class TimetableDataset:
    title: str
    teacher_name: str
    class_name: str
    weekdays: list[str]
    rows: list[TimetableRow]
    school_name: str = ""
    academic_year: str = ""


def timetable_dataset(
    periods: list[tuple[str, str, str]],
    cells: dict[tuple[int, str], str],
    *,
    teacher_name: str = "",
    class_name: str,
    weekdays: list[str],
    school_name: str = "",
    academic_year: str = "",
) -> TimetableDataset:
    """Build the printable weekly timetable.

    `periods` are (period_id, label, time_range) in display order; `cells` maps
    (weekday_index, period_id) to the subject name.
    """
    width = len(weekdays)
    return TimetableDataset(
        title="برنامه هفتگی",
        teacher_name=teacher_name,
        class_name=class_name,
        weekdays=list(weekdays),
        school_name=school_name,
        academic_year=academic_year,
        rows=[
            TimetableRow(
                period_label=label,
                time_range=timerange,
                cells=[cells.get((day, period_id)) for day in range(width)],
            )
            for period_id, label, timerange in periods
        ],
    )
