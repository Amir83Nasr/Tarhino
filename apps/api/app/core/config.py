from functools import lru_cache
from pathlib import Path
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root .env, shared with the web app.
ENV_FILE = Path(__file__).resolve().parents[4] / ".env"

# libpq-only query params that asyncpg does not understand.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding"}
_TLS_SSLMODES = {"require", "verify-ca", "verify-full"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    app_env: str = "development"
    app_name: str = "Tarhino"

    database_url: str
    secret_key: str

    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30
    refresh_cookie_secure: bool = True
    # "lax" when the web app and the API share a registrable domain,
    # "none" when they do not (Vercel web + Fly API). "none" requires HTTPS.
    refresh_cookie_samesite: Literal["lax", "none", "strict"] = "lax"

    cors_origins: str = "http://localhost:3000"

    @field_validator("database_url")
    @classmethod
    def use_async_driver(cls, url: str) -> str:
        """Force the asyncpg driver.

        Neon and most providers hand out `postgresql://…`, which SQLAlchemy maps to
        the sync psycopg2 driver. The engine here is async, so rewrite the scheme
        rather than making every developer hand-edit the URL.
        """
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url.removeprefix(prefix)
        return url

    @property
    def engine_url(self) -> str:
        """database_url minus the libpq-only query params.

        `sslmode` and `channel_binding` come from the provider's connection string
        but asyncpg rejects them as unknown connect keywords. TLS is carried through
        connect_args instead.
        """
        parts = urlsplit(self.database_url)
        query = urlencode(
            [(k, v) for k, v in parse_qsl(parts.query) if k not in _LIBPQ_ONLY_PARAMS]
        )
        return urlunsplit(parts._replace(query=query))

    @property
    def connect_args(self) -> dict[str, Any]:
        sslmode = dict(parse_qsl(urlsplit(self.database_url).query)).get("sslmode")
        return {"ssl": True} if sslmode in _TLS_SSLMODES else {}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
