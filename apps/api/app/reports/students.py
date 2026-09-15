"""Student-list report dataset: pure builder over domain rows."""

from dataclasses import dataclass


@dataclass(frozen=True)
class StudentListDataset:
    title: str
    teacher_name: str
    class_name: str
    rows: list[tuple[int, str, str]]  # (index, first_name, last_name)


def student_list_dataset(
    students: list[tuple[str, str]],
    *,
    teacher_name: str = "",
    class_name: str,
) -> StudentListDataset:
    """Build the printable student list. `students` are (first, last) pairs."""
    return StudentListDataset(
        title="فهرست دانش‌آموزان",
        teacher_name=teacher_name,
        class_name=class_name,
        rows=[(i + 1, first, last) for i, (first, last) in enumerate(students)],
    )
