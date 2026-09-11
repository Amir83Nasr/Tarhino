from app.core.vault import decrypt_secret, encrypt_secret
from app.main import API_PREFIX, app


def test_vault_roundtrip() -> None:
    token = encrypt_secret("sk-or-v1-secret")
    assert token != b"sk-or-v1-secret"
    assert decrypt_secret(token) == "sk-or-v1-secret"


def test_vault_rejects_tampered() -> None:
    token = encrypt_secret("sk-or-v1-secret")
    assert decrypt_secret(token[:-4] + b"AAAA") is None


def test_ai_routes_are_registered() -> None:
    paths = set(app.openapi()["paths"])
    assert f"{API_PREFIX}/ai/settings" in paths
    assert f"{API_PREFIX}/ai/settings/key" in paths
    assert f"{API_PREFIX}/ai/chat" in paths
