"""Jalali → Gregorian conversion.

Ported from the Borkowski algorithm that jalaali-js uses, so the backend can
place Iranian dates without taking on a calendar dependency. The reverse
direction is not needed yet: nothing on the server parses Jalali input.

Only fixed solar holidays are derived from this; lunar (Hijri) occasions move
every year and belong to a data source, not a formula.
"""


def _is_leap_gregorian(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


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
