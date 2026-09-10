import pytest

from app.core.jalali import jalali_to_gregorian

# (jalali) -> (gregorian). Nowruz and a mid-year date, plus a leap-year boundary.
CASES = [
    ((1405, 6, 19), (2026, 9, 10)),
    ((1404, 1, 1), (2025, 3, 21)),
    ((1403, 1, 1), (2024, 3, 20)),
    ((1399, 12, 30), (2021, 3, 20)),
]


@pytest.mark.parametrize(("jalali", "gregorian"), CASES)
def test_jalali_to_gregorian(jalali: tuple[int, int, int], gregorian: tuple[int, int, int]):
    assert jalali_to_gregorian(*jalali) == gregorian
