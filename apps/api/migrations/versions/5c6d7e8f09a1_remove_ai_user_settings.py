"""remove per-user AI settings, server-controlled only

Revision ID: 5c6d7e8f09a1
Revises: 4b5c6d7e8f09
Create Date: 2026-09-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5c6d7e8f09a1"
down_revision: str | None = "4b5c6d7e8f09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("users", "ai_api_key_enc")
    op.drop_column("users", "ai_model")
    op.drop_column("users", "ai_base_url")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("ai_base_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("ai_model", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("ai_api_key_enc", sa.LargeBinary(), nullable=True),
    )
