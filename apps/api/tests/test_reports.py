import datetime as dt

from app.core.jalali import (
    gregorian_to_jalali,
    month_name,
    numeric_jalali,
    to_persian_digits,
    weekday_name,
)
from app.main import API_PREFIX, app
from app.reports.grades import (
    GradeScaleBands,
    describe_level,
    format_grade,
    grade_sheet_dataset,
    level_value,
    value_for_level_label,
)
from app.reports.pdf import (
    _fmt_day,
    _fmt_time_range,
    grade_sheet_filename,
    jalali_stamp,
    pdf_response,
    schedule_filename,
    student_list_filename,
)
from app.reports.schedule import schedule_dataset
from app.reports.students import student_list_dataset


def test_student_list_dataset_numbers_rows() -> None:
    dataset = student_list_dataset(
        [("علی", "احمدی")], teacher_name="سارا معلم", class_name="هفتم الف"
    )
    assert dataset.rows == [(1, "علی", "احمدی")]
    assert dataset.class_name == "هفتم الف"
    assert dataset.teacher_name == "سارا معلم"


def test_report_routes_are_registered() -> None:
    paths = set(app.openapi()["paths"])
    assert f"{API_PREFIX}/reports/students/{{class_id}}.pdf" in paths
    assert f"{API_PREFIX}/reports/grades/{{subject_id}}.pdf" in paths
    assert f"{API_PREFIX}/reports/schedule.pdf" in paths


def test_grade_sheet_dataset_pivots_cells() -> None:
    dataset = grade_sheet_dataset(
        ["علی احمدی", "سارا موسوی"],
        ["امتحان اول", "امتحان دوم"],
        {("علی احمدی", "امتحان اول"): 18.0, ("سارا موسوی", "امتحان دوم"): 20.0},
        teacher_name="سارا معلم",
        subject_name="ریاضی",
        class_name="هفتم الف",
    )
    assert dataset.assessments == ["امتحان اول", "امتحان دوم"]
    assert dataset.teacher_name == "سارا معلم"
    assert [(r.name, r.cells, r.average, r.level) for r in dataset.rows] == [
        ("علی احمدی", ["۱۸", None], "۱۸", "خیلی خوب"),
        ("سارا موسوی", [None, "۲۰"], "۲۰", "خیلی خوب"),
    ]


def test_grade_sheet_dataset_averages_present_cells() -> None:
    dataset = grade_sheet_dataset(
        ["علی احمدی"],
        ["امتحان اول", "امتحان دوم"],
        {("علی احمدی", "امتحان اول"): 18.5, ("علی احمدی", "امتحان دوم"): 15.0},
        subject_name="ریاضی",
        class_name="هفتم الف",
    )
    (row,) = dataset.rows
    assert row.cells == ["۱۸٫۵", "۱۵"]
    assert row.average == "۱۶٫۷۵"
    assert row.level == "خوب"


def test_grade_sheet_dataset_empty_row() -> None:
    dataset = grade_sheet_dataset(
        ["علی احمدی"], ["امتحان اول"], {}, subject_name="ریاضی", class_name="هفتم الف"
    )
    (row,) = dataset.rows
    assert row.cells == [None]
    assert row.average is None
    assert row.level is None


def test_describe_level_bands() -> None:
    assert describe_level(20) == "خیلی خوب"
    assert describe_level(18) == "خیلی خوب"
    assert describe_level(17.99) == "خوب"
    assert describe_level(15) == "خوب"
    assert describe_level(14.99) == "قابل قبول"
    assert describe_level(10) == "قابل قبول"
    assert describe_level(9.99) == "نیازمند تلاش بیشتر"


def test_describe_level_custom_scale() -> None:
    scale = GradeScaleBands(
        excellent_min=19,
        good_min=16,
        pass_min=12,
        excellent_label="عالی",
        good_label="شایسته",
        fair_label="متوسط",
        needs_label="ضعیف",
    )
    assert describe_level(19, scale) == "عالی"
    assert describe_level(18.99, scale) == "شایسته"
    assert describe_level(12, scale) == "متوسط"
    assert describe_level(11.99, scale) == "ضعیف"


def test_grade_sheet_dataset_custom_scale_labels_average() -> None:
    scale = GradeScaleBands(
        excellent_min=19,
        good_min=16,
        pass_min=12,
        excellent_label="عالی",
        good_label="شایسته",
        fair_label="متوسط",
        needs_label="ضعیف",
    )
    dataset = grade_sheet_dataset(
        ["علی احمدی"],
        ["امتحان اول", "امتحان دوم"],
        {("علی احمدی", "امتحان اول"): 18.0, ("علی احمدی", "امتحان دوم"): 17.0},
        subject_name="ریاضی",
        class_name="هفتم الف",
        scale=scale,
    )
    (row,) = dataset.rows
    assert row.average == "۱۷٫۵"
    assert row.level == "شایسته"


def test_level_value_stays_inside_its_band() -> None:
    # Round-trip: the stored value for a picked level re-describes to itself.
    scale = GradeScaleBands()
    for level, label in (
        ("excellent", scale.excellent_label),
        ("good", scale.good_label),
        ("fair", scale.fair_label),
        ("needs", scale.needs_label),
    ):
        assert describe_level(level_value(level, scale), scale) == label
    assert value_for_level_label(scale.excellent_label, scale) == 18
    assert describe_level(value_for_level_label(scale.good_label, scale), scale) == (
        scale.good_label
    )
    assert describe_level(value_for_level_label(scale.fair_label, scale), scale) == (
        scale.fair_label
    )
    assert describe_level(value_for_level_label(scale.needs_label, scale), scale) == (
        scale.needs_label
    )


def test_level_value_custom_scale_round_trips() -> None:
    scale = GradeScaleBands(
        excellent_min=19,
        good_min=16,
        pass_min=12,
        excellent_label="عالی",
        good_label="شایسته",
        fair_label="متوسط",
        needs_label="ضعیف",
    )
    for label in ("عالی", "شایسته", "متوسط", "ضعیف"):
        assert describe_level(value_for_level_label(label, scale), scale) == label


def test_grade_sheet_dataset_descriptive_hides_numbers() -> None:
    dataset = grade_sheet_dataset(
        ["علی احمدی"],
        ["امتحان اول"],
        {("علی احمدی", "امتحان اول"): 18.0},
        subject_name="ریاضی",
        class_name="هفتم الف",
        numeric=False,
    )
    (row,) = dataset.rows
    assert row.cells == ["خیلی خوب"]
    assert row.average is None
    assert row.level == "خیلی خوب"
    assert dataset.numeric is False


def test_format_grade_trims_zeros() -> None:
    assert format_grade(18) == "۱۸"
    assert format_grade(18.5) == "۱۸٫۵"
    assert format_grade(17.75) == "۱۷٫۷۵"


def test_schedule_dataset_keeps_empty_days() -> None:
    dataset = schedule_dataset(
        [
            ("2026-09-13", [("تمرین", "هفتم الف", "ریاضی", "زنگ اول", "08:00-09:30")]),
            ("2026-09-14", []),
        ],
        teacher_name="سارا معلم",
        range_label="بازه",
    )
    assert dataset.days[1] == ("2026-09-14", [])
    assert dataset.teacher_name == "سارا معلم"


def test_jalali_helpers_match_frontend_style() -> None:
    assert gregorian_to_jalali(2026, 9, 13) == (1405, 6, 22)
    assert numeric_jalali(dt.date(2026, 9, 13)) == "۱۴۰۵٫۰۶٫۲۲"
    assert weekday_name(dt.date(2026, 9, 13)) == "یک‌شنبه"
    assert month_name(6) == "شهریور"
    assert to_persian_digits(1405) == "۱۴۰۵"
    assert _fmt_day("2026-09-13") == "یک‌شنبه ۱۴۰۵٫۰۶٫۲۲"
    assert _fmt_day("not-a-date") == "not-a-date"
    assert _fmt_time_range("08:00-09:30") == "۰۸:۰۰ تا ۰۹:۳۰"
    assert _fmt_time_range("garbage") == "garbage"


def test_pdf_filenames_are_persian_and_stamped() -> None:
    day = dt.date(2026, 9, 13)
    assert jalali_stamp(day) == "1405-06-22"
    assert student_list_filename("هفتم الف", day) == "فهرست-دانش‌آموزان-هفتم-الف-1405-06-22.pdf"
    assert grade_sheet_filename("ریاضی", "هفتم الف", day) == "کارنامه-ریاضی-هفتم-الف-1405-06-22.pdf"
    assert schedule_filename(day, dt.date(2026, 9, 19)) == "طرح-درس-1405-06-22-تا-1405-06-28.pdf"


def test_pdf_response_sets_disposition() -> None:
    response = pdf_response(b"%PDF-", "کارنامه-ریاضی-1405-06-22.pdf")
    assert response.media_type == "application/pdf"
    disposition = response.headers["content-disposition"]
    assert "attachment" in disposition
    assert "filename*=UTF-8''" in disposition
