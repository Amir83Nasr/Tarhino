import os

# Set before app.core.config is imported. Environment variables outrank .env in
# pydantic-settings, so tests never touch the developer's real database.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
