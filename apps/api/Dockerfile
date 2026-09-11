# ── API DOCKERFILE ─────────────────────────────────────────

# Build context is the repo root (Settings reads the root .env at runtime via
# a mounted env file, never baked in).  Run from the repo root:
#   docker build -f apps/api/Dockerfile -t tarhino-api .

FROM python:3.14-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy
# uv upstream binary — the official python image has no uv preinstalled.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# ── DEPS ─────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY apps/api/pyproject.toml apps/api/uv.lock ./apps/api/
# Sync only runtime deps into a portable venv (no dev group: pytest, ruff…).
RUN uv sync --frozen --no-dev --project apps/api --no-install-project

# ── RUN ──────────────────────────────────────────────────────
FROM base AS runner
RUN groupadd --system --gid 1001 appgroup \
 && useradd --system --uid 1001 --gid appgroup appuser
WORKDIR /app/apps/api
COPY --from=deps /app/apps/api/.venv ./.venv
COPY apps/api/app ./app
COPY apps/api/migrations ./migrations
COPY apps/api/alembic.ini ./
ENV PATH="/app/apps/api/.venv/bin:$PATH"
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
