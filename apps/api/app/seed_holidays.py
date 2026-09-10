"""Seed official Iranian holidays that fall on a fixed Jalali date.

Run: uv run python -m app.seed_holidays

Idempotent: each row's UUID is derived from its Jalali date and title, so
re-running only inserts what is missing.

ponytail: solar (fixed-date) holidays only. Lunar occasions — Tasua, Ashura,
Arbaeen, Ramadan, Eid al-Fitr, Eid al-Qurban, Eid al-Ghadir — move ~11 days
earlier each year and need a published table, not a formula. Add a data file
(and an admin path to refresh it) when teachers start asking for them.
"""

import asyncio
import datetime as dt
import uuid

from sqlalchemy import select

from app.core.jalali import jalali_to_gregorian
from app.db.session import SessionLocal
from app.models.teaching import Holiday

# Kept stable across releases; changing it would orphan every seeded row.
NAMESPACE = uuid.UUID("6f6c1f2a-5b7a-4e1e-9d0f-2c3a4b5c6d7e")

# (month, day, title) in the Jalali calendar.
FIXED_HOLIDAYS: list[tuple[int, int, str]] = [
    (1, 1, "نوروز"),
    (1, 2, "نوروز"),
    (1, 3, "نوروز"),
    (1, 4, "نوروز"),
    (1, 12, "روز جمهوری اسلامی"),
    (1, 13, "روز طبیعت"),
    (3, 14, "رحلت امام خمینی"),
    (3, 15, "قیام ۱۵ خرداد"),
    (11, 22, "پیروزی انقلاب اسلامی"),
    (12, 29, "روز ملی شدن صنعت نفت"),
]

# Wide enough that a teacher never has to think about it mid-career.
FIRST_YEAR, LAST_YEAR = 1403, 1412


def holiday_id(jy: int, jm: int, jd: int, title: str) -> uuid.UUID:
    return uuid.uuid5(NAMESPACE, f"{jy}-{jm}-{jd}-{title}")


def rows() -> list[Holiday]:
    seeded: list[Holiday] = []
    for jy in range(FIRST_YEAR, LAST_YEAR + 1):
        for jm, jd, title in FIXED_HOLIDAYS:
            gy, gm, gd = jalali_to_gregorian(jy, jm, jd)
            seeded.append(
                Holiday(
                    id=holiday_id(jy, jm, jd, title),
                    user_id=None,  # global: visible to every teacher
                    date=dt.date(gy, gm, gd),
                    title=title,
                    type="official",
                    description=None,
                )
            )
    return seeded


async def seed() -> int:
    async with SessionLocal() as session:
        candidates = rows()
        existing = set(
            await session.scalars(
                select(Holiday.id).where(Holiday.id.in_([h.id for h in candidates]))
            )
        )
        fresh = [h for h in candidates if h.id not in existing]
        session.add_all(fresh)
        await session.commit()
        return len(fresh)


if __name__ == "__main__":
    print(f"inserted {asyncio.run(seed())} holidays")
