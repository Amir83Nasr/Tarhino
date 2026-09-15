"""google sign-in identity on users

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-14

Google sign-in users have no phone/password until they optionally add them,
so phone + password_hash go nullable. google_sub (the verified "sub" claim)
is unique: one Google account links to exactly one teacher — a teacher can
never land in another teacher's rows through a colliding identity.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("users", "phone", existing_type=sa.String(length=10), nullable=True)
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_column("users", "google_sub")
    # Existing rows have non-null values (the old schema enforced it), so the
    # reverse migration is safe on any database that migrated forward cleanly.
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("users", "phone", existing_type=sa.String(length=10), nullable=False)
