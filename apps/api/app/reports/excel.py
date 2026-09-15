"""Timetable Excel export: HTML-table .xls from stdlib only.

ponytail: this is an HTML table served as .xls, not real OOXML. Excel opens
it as a plain grid. Upgrade to openpyxl when styling beyond a plain grid
(borders, column widths, frozen panes) is needed.
"""

import datetime as dt
from html import escape
from urllib.parse import quote

from fastapi import Response

from app.reports.pdf import jalali_stamp

_FALLBACK = "tarhino-timetable.xls"


def timetable_excel_filename(class_name: str, day: dt.date) -> str:
    """Persian filename for the timetable workbook, e.g. برنامه-هفتگی-....xls."""
    slug = class_name.replace(" ", "-")
    return f"برنامه-هفتگی-{slug}-{jalali_stamp(day)}.xls"


def timetable_excel_html(dataset: object) -> str:
    """Render the timetable grid as a single RTL table Excel can open."""
    from app.reports.timetable import TimetableDataset

    assert isinstance(dataset, TimetableDataset)
    head = "".join(f'<th style="text-align:center">{escape(day)}</th>' for day in dataset.weekdays)
    body = "\n".join(
        f'<tr><td style="text-align:center">{escape(row.period_label)}'
        + (f"<br>{escape(row.time_range)}" if row.time_range else "")
        + "</td>"
        + "".join(
            f'<td style="text-align:center">{escape(cell) if cell is not None else "—"}</td>'
            for cell in row.cells
        )
        + "</tr>"
        for row in dataset.rows
    )
    header_rows = [
        (
            f'<tr><td colspan="{len(dataset.weekdays) + 1}" '
            f'style="text-align:center;font-weight:bold">{escape(dataset.title)}</td></tr>'
        ),
    ]
    if dataset.school_name:
        header_rows.append(
            f'<tr><td colspan="{len(dataset.weekdays) + 1}" '
            f'style="text-align:center">مدرسه: {escape(dataset.school_name)}</td></tr>'
        )
    details = " — ".join(
        p
        for p in [
            f"کلاس: {escape(dataset.class_name)}",
            f"آموزگار: {escape(dataset.teacher_name)}" if dataset.teacher_name else "",
            f"سال تحصیلی: {escape(dataset.academic_year)}" if dataset.academic_year else "",
        ]
        if p
    )
    if details:
        header_rows.append(
            f'<tr><td colspan="{len(dataset.weekdays) + 1}" '
            f'style="text-align:center">{details}</td></tr>'
        )
    return (
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" '
        'xmlns:x="urn:schemas-microsoft-com:office:excel" lang="fa" dir="rtl">'
        '<head><meta charset="utf-8"></head><body>'
        f'<table border="1" dir="rtl">{"".join(header_rows)}'
        f'<tr><th style="text-align:center">زنگ</th>{head}</tr>'
        f"{body}</table></body></html>"
    )


def excel_response(html: str, filename: str) -> Response:
    """Workbook download with a Persian filename (RFC 5987) + ASCII fallback."""
    return Response(
        # BOM so Excel detects UTF-8 Persian text instead of latin-1 mojibake.
        content=html.encode("utf-8-sig"),
        media_type="application/vnd.ms-excel",
        headers={
            "Content-Disposition": f'attachment; filename="{_FALLBACK}"; '
            f"filename*=UTF-8''{quote(filename)}"
        },
    )
