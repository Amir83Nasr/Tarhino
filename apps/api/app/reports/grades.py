"""Grade-sheet report dataset: pure builder over domain rows."""

from dataclasses import dataclass

from app.core.jalali import to_persian_digits


@dataclass(frozen=True)
class GradeRow:
    name: str
    cells: list[str | None]  # one formatted cell per assessment
    average: str | None  # formatted mean of the present cells
    level: str | None  # descriptive band for the average


@dataclass(frozen=True)
class GradeSheetDataset:
    title: str
    teacher_name: str
    subject_name: str
    class_name: str
    assessments: list[str]
    rows: list[GradeRow]
    # False in whole-teacher descriptive mode: numbers hidden, only levels print.
    numeric: bool = True


@dataclass(frozen=True)
class GradeScaleBands:
    """Per-subject descriptive bands. Thresholds descend: excellent > good > pass."""

    excellent_min: float = 18
    good_min: float = 15
    pass_min: float = 10
    excellent_label: str = "خیلی خوب"
    good_label: str = "خوب"
    fair_label: str = "قابل قبول"
    needs_label: str = "نیازمند تلاش بیشتر"


DEFAULT_SCALE = GradeScaleBands()

# Whole-teacher descriptive mode: picking a level stores a representative 0–20
# value (top of the band) so averages keep working; the label is what the
# teacher picked. `level_value` is the inverse of `describe_level`.
MODE_LEVEL_VALUES = ("excellent", "good", "fair", "needs")


def level_value(level: str, scale: GradeScaleBands = DEFAULT_SCALE) -> float:
    """Representative stored value for a picked level (top of its band)."""
    if level == "excellent":
        return float(scale.excellent_min)
    if level == "good":
        return min(float(scale.good_min) + 2, float(scale.excellent_min) - 0.25)
    if level == "fair":
        return min(float(scale.pass_min) + 2, float(scale.good_min) - 0.25)
    return max(float(scale.pass_min) - 1, 0)


def value_for_level_label(label: str, scale: GradeScaleBands = DEFAULT_SCALE) -> float:
    """Stored value for a picked label under the given per-subject scale."""
    if label == scale.excellent_label:
        return float(scale.excellent_min)
    if label == scale.good_label:
        return level_value("good", scale)
    if label == scale.fair_label:
        return level_value("fair", scale)
    if label == scale.needs_label:
        return level_value("needs", scale)
    raise ValueError("Unknown level label")


def describe_level(value: float, scale: GradeScaleBands = DEFAULT_SCALE) -> str:
    """Descriptive band for a 0–20 value under the given per-subject scale."""
    if value >= scale.excellent_min:
        return scale.excellent_label
    if value >= scale.good_min:
        return scale.good_label
    if value >= scale.pass_min:
        return scale.fair_label
    return scale.needs_label


def format_grade(value: float) -> str:
    """'18.5' -> '۱۸٫۵'. Trailing zeros trimmed, Persian glyphs."""
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return to_persian_digits(text.replace(".", "٫"))


def grade_sheet_dataset(
    students: list[str],
    assessments: list[str],
    grades: dict[tuple[str, str], float],
    *,
    teacher_name: str = "",
    subject_name: str,
    class_name: str,
    scale: GradeScaleBands = DEFAULT_SCALE,
    numeric: bool = True,
) -> GradeSheetDataset:
    """Build the printable grade sheet. `grades` maps (student, assessment) → value.

    Descriptive whole-teacher mode (numeric=False) hides numbers: cells show the
    level for each stored value, average stays blank (no mean of levels).
    """
    rows = []
    for name in students:
        values = [grades.get((name, a)) for a in assessments]
        present = [v for v in values if v is not None]
        average = sum(present) / len(present) if present else None
        rows.append(
            GradeRow(
                name=name,
                cells=[
                    format_grade(v)
                    if (v is not None and numeric)
                    else (describe_level(v, scale) if v is not None else None)
                    for v in values
                ],
                average=(format_grade(average) if (average is not None and numeric) else None),
                level=describe_level(average, scale) if average is not None else None,
            )
        )
    return GradeSheetDataset(
        title="کارنامه",
        teacher_name=teacher_name,
        subject_name=subject_name,
        class_name=class_name,
        assessments=list(assessments),
        rows=rows,
        numeric=numeric,
    )
