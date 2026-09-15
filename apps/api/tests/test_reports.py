import datetime as dt

from app.core.jalali import (
    academic_year_label,
    gregorian_to_jalali,
    month_name,
    numeric_jalali,
    to_persian_digits,
    weekday_name,
)
from app.main import API_PREFIX, app
from app.reports.excel import (
    excel_response,
    timetable_excel_filename,
    timetable_excel_html,
)
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
    report_card_filename,
    schedule_filename,
    student_list_filename,
    timetable_filename,
)
from app.reports.report_card import build_student_card, report_card_dataset
from app.reports.schedule import schedule_dataset
from app.reports.students import student_list_dataset
from app.reports.timetable import timetable_dataset


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
    assert f"{API_PREFIX}/reports/report-cards/{{class_id}}.pdf" in paths
    assert f"{API_PREFIX}/reports/report-cards/{{class_id}}/{{student_id}}.pdf" in paths
    assert f"{API_PREFIX}/reports/schedule.pdf" in paths
    assert f"{API_PREFIX}/reports/timetable/{{class_id}}.pdf" in paths


def test_timetable_dataset_pivots_cells() -> None:
    dataset = timetable_dataset(
        [("p1", "زنگ اول", "۰۸:۰۰ تا ۰۹:۳۰"), ("p2", "زنگ دوم", "۰۹:۴۵ تا ۱۱:۱۵")],
        {(0, "p1"): "ریاضی", (2, "p2"): "فارسی"},
        teacher_name="سارا معلم",
        class_name="هفتم الف",
        weekdays=["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"],
        school_name="قیام",
        academic_year="۱۴۰۵–۱۴۰۶",
    )
    assert dataset.title == "برنامه هفتگی"
    assert [r.period_label for r in dataset.rows] == ["زنگ اول", "زنگ دوم"]
    assert dataset.rows[0].cells == ["ریاضی", None, None, None, None]
    assert dataset.rows[1].cells == [None, None, "فارسی", None, None]
    assert dataset.school_name == "قیام"
    assert dataset.academic_year == "۱۴۰۵–۱۴۰۶"


def test_timetable_html_has_centered_header_and_cells() -> None:
    from app.reports.pdf import _timetable_html

    dataset = timetable_dataset(
        [("p1", "زنگ اول", "۰۸:۰۰ تا ۰۹:۳۰")],
        {(0, "p1"): "ریاضی"},
        teacher_name="سارا معلم",
        class_name="هفتم الف",
        weekdays=["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"],
        school_name="قیام",
        academic_year="۱۴۰۵–۱۴۰۶",
    )
    html = _timetable_html(dataset)
    assert "برنامه هفتگی" in html
    assert "مدرسه: قیام" in html
    assert "کلاس: هفتم الف" in html
    assert "آموزگار: سارا معلم" in html
    assert "سال تحصیلی: ۱۴۰۵–۱۴۰۶" in html
    assert 'class="timetable-head"' in html
    assert 'class="timetable"' in html


def test_timetable_filename_includes_class_and_stamp() -> None:
    day = dt.date(2026, 9, 15)
    assert timetable_filename("هفتم الف", day) == f"برنامه-هفتگی-هفتم-الف-{jalali_stamp(day)}.pdf"


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


def test_grade_sheet_dataset_labels_average_with_fixed_bands() -> None:
    dataset = grade_sheet_dataset(
        ["علی احمدی"],
        ["امتحان اول", "امتحان دوم"],
        {("علی احمدی", "امتحان اول"): 18.0, ("علی احمدی", "امتحان دوم"): 17.0},
        subject_name="ریاضی",
        class_name="هفتم الف",
    )
    (row,) = dataset.rows
    assert row.average == "۱۷٫۵"
    assert row.level == "خوب"


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
            ("2026-09-13", [("زنگ اول", "ریاضی", "تمرین")]),
            ("2026-09-14", []),
        ],
        teacher_name="سارا معلم",
        range_label="بازه",
    )
    assert dataset.days[1] == ("2026-09-14", [])
    assert dataset.teacher_name == "سارا معلم"
    assert dataset.title == "طرح درس هفتگی و روزانه"


def test_academic_year_label_splits_on_mehr() -> None:
    # Shahrivar 1405 belongs to 1404–1405; Mehr 1405 starts 1405–1406.
    assert academic_year_label(dt.date(2026, 9, 13)) == "۱۴۰۴–۱۴۰۵"
    assert academic_year_label(dt.date(2026, 9, 23)) == "۱۴۰۵–۱۴۰۶"


def test_schedule_dataset_carries_header_fields() -> None:
    dataset = schedule_dataset(
        [("2026-09-13", [])],
        teacher_name="سارا معلم",
        range_label="بازه",
        school_name="قیام",
        class_name="هفتم الف",
        academic_year="۱۴۰۵–۱۴۰۶",
    )
    assert dataset.school_name == "قیام"
    assert dataset.class_name == "هفتم الف"
    assert dataset.academic_year == "۱۴۰۵–۱۴۰۶"


def test_schedule_pdf_splits_weeks_at_saturday() -> None:
    from app.reports.pdf import _schedule_html, _week_groups

    days = [
        ("2026-09-19", [("زنگ اول", "ریاضی", "تمرین")]),  # Saturday
        ("2026-09-20", [("زنگ اول", "فارسی", "خواندن")]),
        ("2026-09-21", []),
        ("2026-09-22", []),
        ("2026-09-23", []),
        ("2026-09-24", []),
        ("2026-09-25", []),
        ("2026-09-26", [("زنگ اول", "علوم", "آزمایش")]),  # next Saturday
    ]
    dataset = schedule_dataset(
        days,
        teacher_name="سارا معلم",
        range_label="بازه",
        school_name="قیام",
        class_name="هفتم الف",
        academic_year="۱۴۰۵–۱۴۰۶",
    )
    weeks = _week_groups(dataset)
    assert [len(w) for w in weeks] == [7, 1]
    html = _schedule_html(dataset)
    # One page per week, full header on each, columns = days + ردیف.
    assert html.count('<div class="week-page"') == 2
    assert html.count("طرح درس هفتگی و روزانه") == 2
    assert html.count("سال تحصیلی:") == 2
    assert html.count("مدرسه:") == 2
    assert "week-table" in html


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
    assert report_card_filename("هفتم الف", day) == "کارنامه-کلاس-هفتم-الف-1405-06-22.pdf"
    assert (
        report_card_filename("هفتم الف", day, "علی احمدی")
        == "کارنامه-علی-احمدی-هفتم-الف-1405-06-22.pdf"
    )
    assert schedule_filename(day, dt.date(2026, 9, 19)) == "طرح-درس-1405-06-22-تا-1405-06-28.pdf"
    assert (
        timetable_excel_filename("هفتم الف", day)
        == f"برنامه-هفتگی-هفتم-الف-{jalali_stamp(day)}.xls"
    )


def test_report_card_collapses_subject_means() -> None:
    card = build_student_card(
        "علی احمدی",
        [
            ("ریاضی", [18.0, 16.0], GradeScaleBands()),
            ("فارسی", [], GradeScaleBands()),
        ],
    )
    assert [(r.subject_name, r.average, r.level) for r in card.rows] == [
        ("ریاضی", "۱۷", "خوب"),
        ("فارسی", None, None),
    ]
    assert card.overall == "۱۷"
    assert card.overall_level == "خوب"


def test_report_card_descriptive_hides_numbers() -> None:
    card = build_student_card(
        "علی احمدی",
        [("ریاضی", [18.0], GradeScaleBands())],
        numeric=False,
    )
    assert [(r.subject_name, r.average, r.level) for r in card.rows] == [
        ("ریاضی", None, "خیلی خوب")
    ]
    assert card.overall is None
    assert card.overall_level == "خیلی خوب"
    dataset = report_card_dataset([card], class_name="هفتم الف", numeric=False)
    assert dataset.title == "کارنامه دانش‌آموز"
    assert dataset.numeric is False


def test_pdf_response_sets_disposition() -> None:
    response = pdf_response(b"%PDF-", "کارنامه-ریاضی-1405-06-22.pdf")
    assert response.media_type == "application/pdf"
    disposition = response.headers["content-disposition"]
    assert "attachment" in disposition
    assert "filename*=UTF-8''" in disposition


def test_timetable_excel_renders_grid_with_bom() -> None:
    dataset = timetable_dataset(
        [("p1", "زنگ اول", "۰۸:۰۰ تا ۰۹:۳۰")],
        {(0, "p1"): "ریاضی"},
        teacher_name="سارا معلم",
        class_name="هفتم الف",
        weekdays=["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه"],
        school_name="قیام",
        academic_year="۱۴۰۵–۱۴۰۶",
    )
    html = timetable_excel_html(dataset)
    assert "مدرسه: قیام" in html
    assert "سال تحصیلی: ۱۴۰۵–۱۴۰۶" in html
    assert "text-align:center" in html
    response = excel_response(html, timetable_excel_filename("هفتم الف", dt.date(2026, 9, 15)))
    assert response.media_type == "application/vnd.ms-excel"
    # BOM first so Excel detects UTF-8; header row, subject, class all present.
    assert response.body.startswith(b"\xef\xbb\xbf")
    assert "شنبه".encode() in response.body
    assert "ریاضی".encode() in response.body
    assert "هفتم الف".encode() in response.body
    assert "filename*=UTF-8''" in response.headers["content-disposition"]


def test_timetable_xls_route_is_registered() -> None:
    paths = set(app.openapi()["paths"])
    assert f"{API_PREFIX}/reports/timetable/{{class_id}}.xls" in paths
