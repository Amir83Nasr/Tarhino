"""class shift + period shift sets

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-09-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "i2j3k4l5m6n7"
down_revision: str | None = "h1i2j3k4l5m6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "classes",
        sa.Column("shift", sa.String(length=16), nullable=False, server_default="morning"),
    )
    op.add_column("classes", sa.Column("shift_anchor", sa.Date(), nullable=True))
    op.add_column(
        "periods",
        sa.Column("shift", sa.String(length=16), nullable=False, server_default="morning"),
    )


def downgrade() -> None:
    op.drop_column("periods", "shift")
    op.drop_column("classes", "shift_anchor")
    op.drop_column("classes", "shift")
