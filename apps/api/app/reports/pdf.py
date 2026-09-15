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
@page { size: PAGE_SIZE; margin: 18mm 15mm; }
body {
  font-family: 'IRANYekanX', sans-serif;
  direction: rtl;
  font-size: 11pt;
  color: #111;
}
h1 { font-size: 16pt; margin: 0 0 4px; }
h2 { font-size: 13pt; margin: 14px 0 6px; }
p.meta { font-size: 10pt; color: #555; margin: 0 0 12px; }
p.sign { margin-top: 28px; font-size: 10pt; color: #555; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 6px 8px; text-align: right; }
th { background: #f0f0f0; font-weight: bold; }
td.num { text-align: center; }
""".replace("FONTS_DIR", _FONTS_DIR.as_uri())

_CSS_PORTRAIT = _CSS.replace("PAGE_SIZE", "A4")
# Grade sheets are wide (one column per assessment): landscape keeps them on one page.
_CSS_LANDSCAPE = _CSS.replace("PAGE_SIZE", "A4 landscape")


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


def schedule_filename(date_from: dt.date, date_to: dt.date) -> str:
    return f"طرح-درس-{jalali_stamp(date_from)}-تا-{jalali_stamp(date_to)}.pdf"


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


def _page(title: str, meta: str, body: str, *, landscape: bool = False, sign: bool = False) -> str:
    css = _CSS_LANDSCAPE if landscape else _CSS_PORTRAIT
    sign_block = '<p class="sign">امضای آموزگار: ........................</p>' if sign else ""
    return f"""<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<style>{css}</style></head><body>
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
        landscape=True,
        sign=True,
    )


def _fmt_day(iso: str) -> str:
    """'2026-09-13' -> 'یک‌شنبه ۱۴۰۵٫۰۶٫۲۲'. Falls back to raw input."""
    try:
        date = dt.date.fromisoformat(iso)
    except ValueError:
        return iso
    return f"{weekday_name(date)} {numeric_jalali(date)}"


def _fmt_time_range(timerange: str) -> str:
    """'08:00-09:30' -> '۰۸:۰۰ تا ۰۹:۳۰'. Falls back to raw input."""
    parts = [p.strip() for p in timerange.split("-", 1)]
    try:
        times = [dt.time.fromisoformat(p) for p in parts]
    except ValueError:
        return timerange
    return " تا ".join(fa_time(t) for t in times)


def _schedule_html(dataset: object) -> str:
    from app.reports.schedule import ScheduleDataset

    assert isinstance(dataset, ScheduleDataset)
    sections = []
    for day_label, entries in dataset.days:
        heading = _fmt_day(day_label)
        if entries:
            rows = "\n".join(
                f"<tr><td>{escape(activity)}</td><td>{escape(klass)}</td>"
                f"<td>{escape(subject)}</td><td>{escape(period)}</td>"
                f"<td>{escape(_fmt_time_range(timerange))}</td></tr>"
                for activity, klass, subject, period, timerange in entries
            )
            table = (
                "<table><thead><tr><th>فعالیت</th><th>کلاس</th><th>درس</th>"
                f"<th>زنگ</th><th>ساعت</th></tr></thead><tbody>{rows}</tbody></table>"
            ).format(rows=rows)
        else:
            table = '<p class="meta">—</p>'
        sections.append(f"<h2>{escape(heading)}</h2>{table}")
    meta = _meta(
        [
            f"آموزگار: {escape(dataset.teacher_name)}" if dataset.teacher_name else "",
            escape(dataset.range_label),
        ]
    )
    return _page(dataset.title, meta, "\n".join(sections))


def render_pdf(kind: str, dataset: object) -> bytes:
    """Render a report dataset to PDF bytes. `kind` selects the template."""
    # Local import: Pango system libs load at call time, not at app startup.
    from weasyprint import HTML

    from app.reports.grades import GradeSheetDataset
    from app.reports.schedule import ScheduleDataset
    from app.reports.students import StudentListDataset

    if kind == "student-list" and isinstance(dataset, StudentListDataset):
        html = _student_list_html(
            dataset.title, dataset.class_name, dataset.rows, dataset.teacher_name
        )
    elif kind == "grade-sheet" and isinstance(dataset, GradeSheetDataset):
        html = _grade_sheet_html(dataset)
    elif kind == "schedule" and isinstance(dataset, ScheduleDataset):
        html = _schedule_html(dataset)
    else:
        raise ValueError(f"Unknown report kind: {kind}")
    return bytes(HTML(string=html).write_pdf())
