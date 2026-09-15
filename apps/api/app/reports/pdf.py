"""One WeasyPrint helper for all reports. RTL, IRANYekanX, A4."""

import datetime as dt
from html import escape
from pathlib import Path
from urllib.parse import quote

from fastapi import Response

from app.core.jalali import format_time as fa_time
from app.core.jalali import (
    gregorian_to_jalali,
    numeric_jalali,
    to_persian_digits,
    weekday_name,
)

_FONTS_DIR = Path(__file__).resolve().parent / "fonts"

_CSS = """
@font-face {
  font-family: 'IRANYekanX';
  src: url('FONTS_DIR/IRANYekanX-Regular.ttf');
}
@font-face {
  font-family: 'IRANYekanX';
  src: url('FONTS_DIR/IRANYekanX-Bold.ttf');
  font-weight: bold;
}
@page { size: A4; margin: 18mm 15mm; }
body {
  font-family: 'IRANYekanX', sans-serif;
  direction: rtl;
  font-size: 11pt;
  color: #111;
}
h1 { font-size: 16pt; margin: 0 0 4px; }
h2 { font-size: 13pt; margin: 14px 0 6px; line-height: 1.8; }
h2 .day-date { font-size: 10pt; font-weight: normal; color: #555; }
p.meta { font-size: 10pt; color: #555; margin: 0 0 12px; }
p.sign { margin-top: 28px; font-size: 10pt; color: #555; }
table { width: 100%; border-collapse: collapse; }
table.card { page-break-after: always; }
table.card:last-child { page-break-after: auto; }
th, td { border: 1px solid #999; padding: 6px 8px; text-align: right; }
th { background: #f0f0f0; font-weight: bold; }
td.num { text-align: center; }
table.timetable { margin-top: 6px; }
table.timetable th, table.timetable td { text-align: center; }
.timetable-head { text-align: center; margin-bottom: 5mm; }
.timetable-head h1 { font-size: 16pt; margin: 0 0 3px; }
.timetable-head p.meta { margin: 0 0 2px; font-size: 11pt; color: #111; }
.week-page { page-break-after: always; height: 261mm; }
.week-page:last-child { page-break-after: auto; }
.week-head { margin: 0 0 4mm; }
.week-head h1 { font-size: 15pt; margin: 0 0 2px; }
.week-head p.meta { margin: 0; }
table.week-table {
  width: 100%;
  height: 232mm;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 1.2mm 1mm;
}
table.week-table th, table.week-table td {
  border: 1px solid #999;
  border-radius: 1mm;
  padding: 4px 5px;
  text-align: right;
  font-size: 9pt;
  vertical-align: top;
  overflow-wrap: anywhere;
}
table.week-table th { background: #f0f0f0; }
table.week-table th:first-child, table.week-table td:first-child {
  width: 11%;
  text-align: center;
}
.week-table .day-date { font-size: 8pt; font-weight: normal; color: #555; }
.week-table .cell-subject { font-weight: bold; }
""".replace("FONTS_DIR", _FONTS_DIR.as_uri())


def jalali_stamp(day: dt.date) -> str:
    """Latin-digit Jalali stamp for filenames, e.g. 1405-06-22."""
    jy, jm, jd = gregorian_to_jalali(day.year, day.month, day.day)
    return f"{jy}-{jm:02d}-{jd:02d}"


def _slug(text: str) -> str:
    return text.replace(" ", "-")


def student_list_filename(class_name: str, day: dt.date) -> str:
    return f"فهرست-دانش‌آموزان-{_slug(class_name)}-{jalali_stamp(day)}.pdf"


def grade_sheet_filename(subject_name: str, class_name: str, day: dt.date) -> str:
    return f"کارنامه-{_slug(subject_name)}-{_slug(class_name)}-{jalali_stamp(day)}.pdf"


def report_card_filename(class_name: str, day: dt.date, student_name: str = "") -> str:
    if student_name:
        return f"کارنامه-{_slug(student_name)}-{_slug(class_name)}-{jalali_stamp(day)}.pdf"
    return f"کارنامه-کلاس-{_slug(class_name)}-{jalali_stamp(day)}.pdf"


def schedule_filename(date_from: dt.date, date_to: dt.date) -> str:
    return f"طرح-درس-{jalali_stamp(date_from)}-تا-{jalali_stamp(date_to)}.pdf"


def timetable_filename(class_name: str, day: dt.date) -> str:
    return f"برنامه-هفتگی-{_slug(class_name)}-{jalali_stamp(day)}.pdf"


def pdf_response(pdf: bytes, filename: str) -> Response:
    """PDF response with a Persian filename (RFC 5987) + ASCII fallback."""
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="tarhino-report.pdf"; '
            f"filename*=UTF-8''{quote(filename)}"
        },
    )


def _meta(parts: list[str]) -> str:
    return " — ".join(p for p in parts if p)


def _page(title: str, meta: str, body: str, *, sign: bool = False) -> str:
    sign_block = '<p class="sign">امضای آموزگار: ........................</p>' if sign else ""
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<style>{_CSS}</style></head><body>
<h1>{escape(title)}</h1>
<p class="meta">{meta}</p>
{body}{sign_block}</body></html>"""


def _student_list_html(
    title: str,
    class_name: str,
    rows: list[tuple[int, str, str]],
    teacher_name: str = "",
    *,
    today: dt.date | None = None,
) -> str:
    body = "\n".join(
        f'<tr><td class="num">{to_persian_digits(i)}</td>'
        f"<td>{escape(first)}</td><td>{escape(last)}</td></tr>"
        for i, first, last in rows
    )
    today = today or dt.datetime.now(dt.UTC).date()
    return _page(
        title,
        _meta(
            [
                f"آموزگار: {escape(teacher_name)}" if teacher_name else "",
                f"کلاس: {escape(class_name)}",
                f"تعداد: {to_persian_digits(len(rows))}",
                f"تاریخ: {numeric_jalali(today)}",
            ]
        ),
        "<table><thead><tr><th>ردیف</th><th>نام</th><th>نام خانوادگی</th></tr></thead>"
        f"<tbody>{body}</tbody></table>",
        sign=True,
    )


def _grade_sheet_html(dataset: object) -> str:
    from app.reports.grades import GradeSheetDataset

    assert isinstance(dataset, GradeSheetDataset)
    head = "".join(f"<th>{escape(a)}</th>" for a in dataset.assessments)
    # Descriptive whole-teacher mode: no numbers anywhere — levels per cell,
    # no average column (a mean of levels is meaningless).
    average_head = "<th>میانگین</th>" if dataset.numeric else ""
    body = "\n".join(
        f"<tr><td>{escape(row.name)}</td>"
        + "".join(
            f'<td class="num">{escape(cell) if cell is not None else "—"}</td>'
            for cell in row.cells
        )
        + (
            f'<td class="num">{escape(row.average) if row.average is not None else "—"}</td>'
            if dataset.numeric
            else ""
        )
        + f"<td><strong>{escape(row.level) if row.level is not None else '—'}</strong></td>"
        + "</tr>"
        for row in dataset.rows
    )
    return _page(
        dataset.title,
        _meta(
            [
                f"آموزگار: {escape(dataset.teacher_name)}" if dataset.teacher_name else "",
                f"درس: {escape(dataset.subject_name)}",
                f"کلاس: {escape(dataset.class_name)}",
            ]
        ),
        "<table><thead><tr><th>دانش‌آموز</th>"
        f"{head}{average_head}<th>سطح</th></tr></thead>"
        f"<tbody>{body}</tbody></table>",
        sign=True,
    )


def _report_card_card_html(card: object, *, numeric: bool) -> str:
    from app.reports.report_card import StudentReportCard

    assert isinstance(card, StudentReportCard)
    average_head = "<th>میانگین</th>" if numeric else ""
    rows = "\n".join(
        f"<tr><td>{escape(row.subject_name)}</td>"
        + (
            f'<td class="num">{escape(row.average) if row.average is not None else "—"}</td>'
            if numeric
            else ""
        )
        + f"<td><strong>{escape(row.level) if row.level is not None else '—'}</strong></td>"
        + "</tr>"
        for row in card.rows
    )
    table = (
        "<table><thead><tr><th>درس</th>"
        f"{average_head}<th>سطح</th></tr></thead>"
        f"<tbody>{rows}</tbody></table>"
    )
    overall = (
        f'<p class="meta">معدل: {escape(card.overall)} — {escape(card.overall_level)}</p>'
        if card.overall is not None and card.overall_level is not None
        else (
            f'<p class="meta">سطح کلی: {escape(card.overall_level)}</p>'
            if card.overall_level is not None
            else ""
        )
    )
    return f"<h2>{escape(card.student_name)}</h2>{table}{overall}"


def _report_card_html(dataset: object) -> str:
    from app.reports.report_card import ReportCardDataset

    assert isinstance(dataset, ReportCardDataset)
    meta = _meta(
        [
            f"آموزگار: {escape(dataset.teacher_name)}" if dataset.teacher_name else "",
            f"کلاس: {escape(dataset.class_name)}",
        ]
    )
    cards = "".join(
        f'<div class="card">{_report_card_card_html(card, numeric=dataset.numeric)}</div>'
        for card in dataset.cards
    )
    return _page(dataset.title, meta, cards, sign=True)


def _fmt_day_parts(iso: str) -> tuple[str, str]:
    """'2026-09-13' -> ('یک‌شنبه', '۱۴۰۵٫۰۶٫۲۲'). Falls back to (raw, '')."""
    try:
        date = dt.date.fromisoformat(iso)
    except ValueError:
        return iso, ""
    return weekday_name(date), numeric_jalali(date)


def _fmt_day(iso: str) -> str:
    """'2026-09-13' -> 'یک‌شنبه ۱۴۰۵٫۰۶٫۲۲'. Falls back to raw input."""
    weekday, numeric = _fmt_day_parts(iso)
    return f"{weekday} {numeric}" if numeric else weekday


def _fmt_time_range(timerange: str) -> str:
    """'08:00-09:30' -> '۰۸:۰۰ تا ۰۹:۳۰'. Falls back to raw input."""
    parts = [p.strip() for p in timerange.split("-", 1)]
    try:
        times = [dt.time.fromisoformat(p) for p in parts]
    except ValueError:
        return timerange
    return " تا ".join(fa_time(t) for t in times)


def _week_groups(dataset: object) -> list[list[tuple[str, list[tuple[str, str, str]]]]]:
    """Split days into Saturday-first weeks of 7 (Sat..Fri)."""
    from app.reports.schedule import ScheduleDataset

    assert isinstance(dataset, ScheduleDataset)
    try:
        for iso, _ in dataset.days:
            dt.date.fromisoformat(iso)
    except ValueError:
        return [list(dataset.days)]
    weeks: list[list[tuple[str, list[tuple[str, str, str]]]]] = []
    current: list[tuple[str, list[tuple[str, str, str]]]] = []
    for iso, entries in dataset.days:
        day = dt.date.fromisoformat(iso)
        if (day.weekday() + 2) % 7 == 0 and current:
            weeks.append(current)
            current = []
        current.append((iso, entries))
    if current:
        weeks.append(current)
    return weeks or [dataset.days]


def _schedule_week_html(dataset: object, days: list[tuple[str, list[tuple[str, str, str]]]]) -> str:
    from app.reports.schedule import ScheduleDataset

    assert isinstance(dataset, ScheduleDataset)
    head = "".join(_schedule_day_header(iso) for iso, _ in days)
    entry_rows = [entries for _, entries in days]
    height = max((len(entries) for entries in entry_rows), default=0)
    body = []
    for index in range(height):
        cells = []
        for entries in entry_rows:
            if index < len(entries):
                period, subject, activity = entries[index]
                text = (
                    f'<div class="cell-subject">{escape(subject)}</div>'
                    f"<div>{escape(activity)}</div>"
                    f'<div class="day-date">{escape(period)}</div>'
                )
            else:
                text = ""
            cells.append(f"<td>{text}</td>")
        body.append(f"<tr><td>{to_persian_digits(index + 1)}</td>{''.join(cells)}</tr>")
    grid = (
        '<table class="week-table"><thead><tr><th>ردیف</th>'
        f"{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"
    )
    header = (
        '<div class="week-head">'
        f"<h1>{escape(dataset.title)}</h1>"
        f'<p class="meta">{_schedule_meta(dataset)}</p></div>'
    )
    return f'<div class="week-page">{header}{grid}</div>'


def _schedule_day_header(iso: str) -> str:
    weekday, numeric = _fmt_day_parts(iso)
    label = (
        f'{escape(weekday)}<br><span class="day-date">{escape(numeric)}</span>'
        if numeric
        else escape(weekday)
    )
    return f"<th>{label}</th>"


def _schedule_meta(dataset: object) -> str:
    from app.reports.schedule import ScheduleDataset

    assert isinstance(dataset, ScheduleDataset)
    return _meta(
        [
            f"سال تحصیلی: {escape(dataset.academic_year)}" if dataset.academic_year else "",
            f"آموزگار: {escape(dataset.teacher_name)}" if dataset.teacher_name else "",
            f"مدرسه: {escape(dataset.school_name)}" if dataset.school_name else "",
            f"کلاس: {escape(dataset.class_name)}" if dataset.class_name else "",
            escape(dataset.range_label),
        ]
    )


def _schedule_html(dataset: object) -> str:
    from app.reports.schedule import ScheduleDataset

    assert isinstance(dataset, ScheduleDataset)
    pages = "".join(_schedule_week_html(dataset, week) for week in _week_groups(dataset))
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<style>{_CSS}</style></head><body>
{pages}</body></html>"""


def _timetable_html(dataset: object) -> str:
    from app.reports.timetable import TimetableDataset

    assert isinstance(dataset, TimetableDataset)
    head = "".join(f"<th>{escape(day)}</th>" for day in dataset.weekdays)
    body = "\n".join(
        f"<tr><td>{escape(row.period_label)}"
        + (f"<br>{escape(row.time_range)}" if row.time_range else "")
        + "</td>"
        + "".join(f"<td>{escape(cell) if cell is not None else '—'}</td>" for cell in row.cells)
        + "</tr>"
        for row in dataset.rows
    )
    header_lines = [dataset.title]
    if dataset.school_name:
        header_lines.append(f"مدرسه: {escape(dataset.school_name)}")
    meta_line = _meta(
        [
            f"کلاس: {escape(dataset.class_name)}",
            f"آموزگار: {escape(dataset.teacher_name)}" if dataset.teacher_name else "",
            f"سال تحصیلی: {escape(dataset.academic_year)}" if dataset.academic_year else "",
        ]
    )
    header = (
        '<div class="timetable-head">'
        + "".join(
            f"<h1>{line}</h1>" if i == 0 else f'<p class="meta">{line}</p>'
            for i, line in enumerate(header_lines)
        )
        + (f'<p class="meta">{meta_line}</p>' if meta_line else "")
        + "</div>"
    )
    return (
        '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
        f"<style>{_CSS}</style></head><body>"
        f"{header}"
        f'<table class="timetable"><thead><tr><th>زنگ</th>{head}</tr></thead>'
        f"<tbody>{body}</tbody></table>"
        "</body></html>"
    )


def render_pdf(kind: str, dataset: object) -> bytes:
    """Render a report dataset to PDF bytes. `kind` selects the template."""
    # Local import: Pango system libs load at call time, not at app startup.
    from weasyprint import HTML

    from app.reports.grades import GradeSheetDataset
    from app.reports.report_card import ReportCardDataset
    from app.reports.schedule import ScheduleDataset
    from app.reports.students import StudentListDataset
    from app.reports.timetable import TimetableDataset

    if kind == "student-list" and isinstance(dataset, StudentListDataset):
        html = _student_list_html(
            dataset.title, dataset.class_name, dataset.rows, dataset.teacher_name
        )
    elif kind == "grade-sheet" and isinstance(dataset, GradeSheetDataset):
        html = _grade_sheet_html(dataset)
    elif kind == "report-card" and isinstance(dataset, ReportCardDataset):
        html = _report_card_html(dataset)
    elif kind == "timetable" and isinstance(dataset, TimetableDataset):
        html = _timetable_html(dataset)
    elif kind == "schedule" and isinstance(dataset, ScheduleDataset):
        html = _schedule_html(dataset)
    else:
        raise ValueError(f"Unknown report kind: {kind}")
    return bytes(HTML(string=html).write_pdf())
