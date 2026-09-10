import pytest

from app.core.phone import normalize_phone
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)


@pytest.mark.parametrize(
    "raw",
    [
        "09123456789",
        "9123456789",
        "+989123456789",
        "989123456789",
        "00989123456789",
        "0912 345 6789",
    ],
)
def test_normalize_phone_accepts_real_world_forms(raw: str) -> None:
    assert normalize_phone(raw) == "9123456789"


@pytest.mark.parametrize("raw", ["", "12345", "0812345678", "912345678", "91234567890"])
def test_normalize_phone_rejects_everything_else(raw: str) -> None:
    with pytest.raises(ValueError):
        normalize_phone(raw)


def test_password_hash_is_salted_and_verifiable() -> None:
    password = "correct horse battery staple"
    first = hash_password(password)
    second = hash_password(password)

    assert first != password
    assert first != second  # unique salt per hash
    assert verify_password(first, password)
    assert not verify_password(first, "wrong password")
    assert not verify_password("not-a-hash", password)


def test_access_token_roundtrip() -> None:
    token = create_access_token("c1f0f6a0-0000-4000-8000-000000000001")
    assert decode_access_token(token) == "c1f0f6a0-0000-4000-8000-000000000001"


def test_access_token_rejects_tampered_and_garbage() -> None:
    token = create_access_token("c1f0f6a0-0000-4000-8000-000000000001")
    assert decode_access_token(token + "x") is None
    assert decode_access_token("not.a.token") is None


def test_refresh_token_is_opaque_and_stored_hashed() -> None:
    raw, token_hash = new_refresh_token()

    assert raw != token_hash
    assert len(token_hash) == 64
    assert hash_refresh_token(raw) == token_hash
    assert new_refresh_token()[0] != raw
