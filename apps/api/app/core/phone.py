import re

_NON_DIGITS = re.compile(r"\D")


def normalize_phone(raw: str) -> str:
    """Canonicalize an Iranian mobile number to 10 digits: 9XXXXXXXXX.

    Accepts 09123456789, 9123456789, 989123456789, +989123456789, 00989123456789.
    Raises ValueError for anything else.
    """
    digits = _NON_DIGITS.sub("", raw)

    if digits.startswith("0098"):
        digits = digits[4:]
    elif digits.startswith("98") and len(digits) == 12:
        digits = digits[2:]

    if digits.startswith("0"):
        digits = digits.removeprefix("0")

    if len(digits) != 10 or not digits.startswith("9"):
        raise ValueError("invalid Iranian mobile number")

    return digits
