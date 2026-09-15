"""Elementary presets: grades 1-6 subjects + 5 bells per shift.

The client sends only grade + shift; the server derives subjects and periods
from these tables, so a crafted request cannot inject arbitrary seed data.
"""

import datetime as dt
from typing import Literal

ElementaryGrade = Literal[
    "پایه اول",
    "پایه دوم",
    "پایه سوم",
    "پایه چهارم",
    "پایه پنجم",
    "پایه ششم",
]
Shift = Literal["morning", "afternoon"]

ELEMENTARY_GRADES: tuple[str, ...] = (
    "پایه اول",
    "پایه دوم",
    "پایه سوم",
    "پایه چهارم",
    "پایه پنجم",
    "پایه ششم",
)

_CORE = ("قرآن", "فارسی", "ریاضی", "علوم تجربی")
_SPORT_ART = ("هنر", "تربیت بدنی")

ELEMENTARY_SUBJECTS: dict[str, tuple[str, ...]] = {
    "پایه اول": (*_CORE, *_SPORT_ART),
    "پایه دوم": ("قرآن", "هدیه‌های آسمان", "فارسی", "ریاضی", "علوم تجربی", *_SPORT_ART),
    "پایه سوم": (
        "قرآن",
        "هدیه‌های آسمان",
        "فارسی",
        "ریاضی",
        "علوم تجربی",
        "مطالعات اجتماعی",
        *_SPORT_ART,
    ),
    "پایه چهارم": (
        "قرآن",
        "هدیه‌های آسمان",
        "فارسی",
        "ریاضی",
        "علوم تجربی",
        "مطالعات اجتماعی",
        *_SPORT_ART,
    ),
    "پایه پنجم": (
        "قرآن",
        "هدیه‌های آسمان",
        "فارسی",
        "ریاضی",
        "علوم تجربی",
        "مطالعات اجتماعی",
        *_SPORT_ART,
    ),
    "پایه ششم": (
        "قرآن",
        "هدیه‌های آسمان",
        "فارسی",
        "ریاضی",
        "علوم تجربی",
        "مطالعات اجتماعی",
        "کار و فناوری",
        "تفکر و پژوهش",
        *_SPORT_ART,
    ),
}

_DEFAULT_CLASS_NAME: dict[str, str] = {
    "پایه اول": "اول الف",
    "پایه دوم": "دوم الف",
    "پایه سوم": "سوم الف",
    "پایه چهارم": "چهارم الف",
    "پایه پنجم": "پنجم الف",
    "پایه ششم": "ششم الف",
}

_LABELS = ("زنگ اول", "زنگ دوم", "زنگ سوم", "زنگ چهارم", "زنگ پنجم")


def _bells(starts: tuple[str, ...]) -> tuple[tuple[str, str, str], ...]:
    """5 bells/day, 45 min each: (label, start, end)."""
    out: list[tuple[str, str, str]] = []
    for label, start in zip(_LABELS, starts):
        hour, minute = (int(part) for part in start.split(":"))
        end_hour, end_minute = divmod(hour * 60 + minute + 45, 60)
        out.append((label, start, f"{end_hour:02d}:{end_minute:02d}"))
    return tuple(out)


SHIFT_PERIODS: dict[str, tuple[tuple[str, str, str], ...]] = {
    "morning": _bells(("07:30", "08:15", "09:00", "09:45", "10:30")),
    "afternoon": _bells(("12:30", "13:15", "14:00", "14:45", "15:30")),
}

SHIFTS: tuple[str, ...] = ("morning", "afternoon", "rotating")


def saturday_of(day: dt.date) -> dt.date:
    """Saturday-first week start: Python Monday=0 -> Saturday=5."""
    return day - dt.timedelta(days=(day.weekday() + 2) % 7)


def effective_shift(shift: str, anchor: dt.date | None, week_start: dt.date) -> str:
    """Which bell set is active for the week of `week_start`.

    Fixed shifts stay; `rotating` alternates weekly around the anchor
    Saturday (even weeks morning, odd weeks afternoon).
    """
    if shift != "rotating":
        return shift
    base = anchor or week_start
    weeks = (saturday_of(week_start) - saturday_of(base)).days // 7
    return "morning" if weeks % 2 == 0 else "afternoon"
