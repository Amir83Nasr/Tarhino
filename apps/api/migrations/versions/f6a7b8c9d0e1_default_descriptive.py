"""default grading mode to descriptive

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "grading_mode",
        existing_type=sa.String(length=16),
        server_default="descriptive",
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "grading_mode",
        existing_type=sa.String(length=16),
        server_default="numeric",
    )
