"""google oauth grants per teacher

Revision ID: a1b2c3d4e5f6
Revises: 9f0a1b2c3d4e
Create Date: 2026-09-14

One row per user: the teacher's own Google grant, refresh token encrypted
at rest (see vault). Reconnecting overwrites the row. Spreadsheets created
by the push land in the teacher's Drive.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "9f0a1b2c3d4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "google_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("google_email", sa.String(length=320), nullable=True),
        sa.Column("refresh_token_enc", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_google_accounts_user_id"), "google_accounts", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_google_accounts_user_id"), table_name="google_accounts")
    op.drop_table("google_accounts")
