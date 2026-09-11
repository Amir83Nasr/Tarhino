"""ai settings on users

Revision ID: 3a7f2c1d9e04
Revises: 2f8c1a4b9d03
Create Date: 2026-09-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3a7f2c1d9e04"
down_revision: str | None = "2f8c1a4b9d03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.drop_column("users", "ai_api_key_enc")
    op.drop_column("users", "ai_model")
    op.drop_column("users", "ai_base_url")
