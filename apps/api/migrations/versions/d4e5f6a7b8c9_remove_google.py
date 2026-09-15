"""remove google integration (sign-in + sheets)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-14

Google sign-in and Sheets are dropped entirely. Auth is phone + password
only: users.phone and users.password_hash go back to NOT NULL, the
google_sub identity column goes away, and the google_accounts table
(encrypted OAuth grants) is removed.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_google_accounts_user_id"), table_name="google_accounts")
    op.drop_table("google_accounts")
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_column("users", "google_sub")
    # Google sign-in users have no phone/password: they cannot survive this
    # migration, so drop them. Phone accounts keep working untouched.
    op.execute(sa.text("DELETE FROM users WHERE phone IS NULL OR password_hash IS NULL"))
    op.alter_column("users", "phone", existing_type=sa.String(length=10), nullable=False)
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)


def downgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)
    op.alter_column("users", "phone", existing_type=sa.String(length=10), nullable=True)
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)
    op.create_table(
        "google_accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("google_email", sa.String(length=320), nullable=True),
        sa.Column("refresh_token_enc", sa.LargeBinary(), nullable=False),
        sa.Column("spreadsheet_id", sa.String(length=128), nullable=True),
        sa.Column("scopes", sa.String(length=512), nullable=False, server_default=""),
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
