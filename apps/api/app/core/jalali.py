"""Jalali ⇄ Gregorian conversion + Persian presentation helpers.

Forward is the Borkowski algorithm; reverse is ported from jalaali-js
(`div`/`mod` there truncate toward zero, so `_div`/`_mod` do the same —
plain `//` would diverge on negative intermediates).

Only fixed solar holidays are derived from this; lunar (Hijri) occasions move
every year and belong to a data source, not a formula.
"""

import datetime as dt
import math


def _is_leap_gregorian(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


# jalaali-js `div`/`mod` truncate toward zero (JS `~~`), unlike Python `//`.
def _div(a: int, b: int) -> int:
    return math.trunc(a / b)


def _mod(a: int, b: int) -> int:
    return a - math.trunc(a / b) * b


def _g2d(gy: int, gm: int, gd: int) -> int:
    d = (
        _div((gy + _div(gm - 8, 6) + 100100) * 1461, 4)
        + _div(153 * _mod(gm + 9, 12) + 2, 5)
        + gd
        - 34840408
    )
    return d - _div(_div(gy + 100100 + _div(gm - 8, 6), 100) * 3, 4) + 752


def _d2g(jdn: int) -> tuple[int, int, int]:
    j = 4 * jdn + 139361631
    j = j + _div(_div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
    i = _div(_mod(j, 1461), 4) * 5 + 308
    gd = _div(_mod(i, 153), 5) + 1
    gm = _mod(_div(i, 153), 12) + 1
    return _div(j, 1461) - 100100 + _div(8 - gm, 6), gm, gd


_BREAKS = (
    -61,
    9,
    38,
    199,
    426,
    686,
    756,
    818,
    1111,
    1181,
    1210,
    1635,
    2060,
    2097,
    2192,
    2262,
    2324,
    2394,
    2456,
    3178,
)


def _jal_cal(jy: int) -> tuple[int, int, int]:
    """Return (leap, gy, march): leap years since last leap, Gregorian year, Farvardin-1 day."""
    gy = jy + 621
    leap_j = -14
    jp = _BREAKS[0]
    jump = 0
    for jm in _BREAKS[1:]:
        jump = jm - jp
        if jy < jm:
            break
        leap_j += _div(jump, 33) * 8 + _div(_mod(jump, 33), 4)
        jp = jm
    n = jy - jp
    leap_j += _div(n, 33) * 8 + _div(_mod(n, 33) + 3, 4)
    if _mod(jump, 33) == 4 and jump - n == 4:
        leap_j += 1
    leap_g = _div(gy, 4) - _div((_div(gy, 100) + 1) * 3, 4) - 150
    march = 20 + leap_j - leap_g
    if jump - n < 6:
        n = n - jump + _div(jump + 4, 33) * 33
    leap = _mod(_mod(n + 1, 33) - 1, 4)
    if leap == -1:
        leap = 4
    return leap, gy, march


def _j2d(jy: int, jm: int, jd: int) -> int:
    _, gy, march = _jal_cal(jy)
    return _g2d(gy, 3, march) + (jm - 1) * 31 - _div(jm, 7) * (jm - 7) + jd - 1


def _d2j(jdn: int) -> tuple[int, int, int]:
    gy, _, _ = _d2g(jdn)
    jy = gy - 621
    leap, _, march = _jal_cal(jy)
    k = jdn - _g2d(gy, 3, march)
    if k >= 0:
        if k <= 185:
            return jy, 1 + _div(k, 31), _mod(k, 31) + 1
        k -= 186
    else:
        jy -= 1
        k += 179
        if leap == 1:
            k += 1
    return jy, 7 + _div(k, 30), _mod(k, 30) + 1


def gregorian_to_jalali(gy: int, gm: int, gd: int) -> tuple[int, int, int]:
    """Return (year, month, day) in the Jalali calendar."""
    return _d2j(_g2d(gy, gm, gd))


_PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
_PERSIAN_MONTHS = (
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
)
_PERSIAN_WEEKDAYS = (  # Saturday-first: index 0 = شنبه
    "شنبه",
    "یک‌شنبه",
    "دوشنبه",
    "سه‌شنبه",
    "چهارشنبه",
    "پنج‌شنبه",
    "جمعه",
)


def to_persian_digits(value: object) -> str:
    """Replace Latin digits with Persian glyphs, e.g. 1405 -> ۱۴۰۵."""
    return "".join(_PERSIAN_DIGITS[ord(c) - ord("0")] if "0" <= c <= "9" else c for c in str(value))


def numeric_jalali(date: dt.date) -> str:
    """App-wide glyph style: date(2026,9,13) -> ۱۴۰۵٫۰۶٫۲۲."""
    jy, jm, jd = gregorian_to_jalali(date.year, date.month, date.day)
    return to_persian_digits(f"{jy}٫{jm:02d}٫{jd:02d}")


def weekday_name(date: dt.date) -> str:
    """Persian weekday, Saturday-first: شنبه … جمعه."""
    return _PERSIAN_WEEKDAYS[(date.weekday() + 2) % 7]


def academic_year_label(date: dt.date) -> str:
    """Jalali school year for a date: Mehr onward jy–jy+1, else jy-1–jy."""
    jy, jm, _ = gregorian_to_jalali(date.year, date.month, date.day)
    start = jy if jm >= 7 else jy - 1
    return f"{to_persian_digits(start)}–{to_persian_digits(start + 1)}"


def month_name(month: int) -> str:
    return _PERSIAN_MONTHS[month - 1]


def format_time(value: dt.time) -> str:
    return to_persian_digits(value.strftime("%H:%M"))


def jalali_to_gregorian(jy: int, jm: int, jd: int) -> tuple[int, int, int]:
    """Return (year, month, day) in the Gregorian calendar."""
    jy += 1595
    days = -355668 + 365 * jy + (jy // 33) * 8 + ((jy % 33) + 3) // 4 + jd
    days += (jm - 1) * 31 if jm < 7 else (jm - 7) * 30 + 186

    gy = 400 * (days // 146097)
    days %= 146097
    if days > 36524:
        days -= 1
        gy += 100 * (days // 36524)
        days %= 36524
        if days >= 365:
            days += 1
    gy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        gy += (days - 1) // 365
        days = (days - 1) % 365
    gd = days + 1

    month_days = (
        0,
        31,
        29 if _is_leap_gregorian(gy) else 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    )
    gm = 0
    while gm < 13 and gd > month_days[gm]:
        gd -= month_days[gm]
        gm += 1
    return gy, gm, gd
