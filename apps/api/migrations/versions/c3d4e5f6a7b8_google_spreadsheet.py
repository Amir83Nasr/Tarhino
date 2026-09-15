"""reuse one spreadsheet per teacher + granted scopes



Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-14

Push overwrites tabs in the teacher's own file instead of creating a new
spreadsheet every time. NULL = no file yet; the next push creates it.

scopes records what the stored grant covers: a login-only grant
("openid email") cannot touch Sheets, so status can tell the teacher to
approve only the missing scopes without forcing a re-login.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "google_accounts",
        sa.Column("spreadsheet_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "google_accounts",
        sa.Column("scopes", sa.String(length=512), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("google_accounts", "scopes")
    op.drop_column("google_accounts", "spreadsheet_id")
