"""refresh_tokens.user_agent

Revision ID: 7e8f09a1b2c3
Revises: 6d7e8f09a1b2
Create Date: 2026-09-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7e8f09a1b2c3"
down_revision: str | None = "6d7e8f09a1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "refresh_tokens",
        sa.Column("user_agent", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "user_agent")
