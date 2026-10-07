"""Attendance-sheet dataset: pure builder over roster + absence rows."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AttendanceRow:
    name: str
    status: str  # "present" | "absent"


@dataclass(frozen=True)
class AttendanceSheetDataset:
    title: str
    teacher_name: str
    class_name: str
    day_label: str
    rows: list[AttendanceRow]
    summary: list[tuple[str, int]]  # (name, absence_count), desc


def attendance_sheet_dataset(
    names: list[str],
    absent: set[str],
    counts: dict[str, int] | None = None,
    *,
    teacher_name: str = "",
    class_name: str,
    day_label: str,
) -> AttendanceSheetDataset:
    """Build the printable day sheet. `absent` holds absent names."""
    rows = [AttendanceRow(name=n, status="absent" if n in absent else "present") for n in names]
    summary = sorted(
        ((n, (counts or {}).get(n, 0)) for n in names),
        key=lambda item: item[1],
        reverse=True,
    )
    return AttendanceSheetDataset(
        title="برگ حضور و غیاب",
        teacher_name=teacher_name,
        class_name=class_name,
        day_label=day_label,
        rows=rows,
        summary=[(n, c) for n, c in summary if c > 0],
    )
