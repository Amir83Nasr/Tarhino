"""Reversible encryption for user-held API keys.

Passwords use one-way argon2; AI provider keys must be sent back out to the
provider, so they need symmetric encryption instead. AES-256-GCM via
cryptography's Fernet, keyed from SECRET_KEY through SHA-256.

ponytail: key rotation (versioned keys, dual-decrypt) when SECRET_KEY itself
ever rotates — today one deploy keeps one key.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _fernet() -> Fernet:
    raw = hashlib.sha256(get_settings().secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_secret(plaintext: str) -> bytes:
    return _fernet().encrypt(plaintext.encode())


def decrypt_secret(ciphertext: bytes) -> str | None:
    try:
        return _fernet().decrypt(ciphertext).decode()
    except (InvalidToken, ValueError, UnicodeDecodeError):
        return None
