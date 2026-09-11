"""drop deleted_at tombstones, hard delete

Revision ID: 2f8c1a4b9d03
Revises: 177c023c2e69
Create Date: 2026-09-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2f8c1a4b9d03"
down_revision: str | None = "177c023c2e69"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop the partial unique index first: it references deleted_at.
    op.drop_index(
        "uq_lesson_plans_active",
        table_name="lesson_plans",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "uq_lesson_plans_active",
        "lesson_plans",
        ["user_id", "date", "period_id"],
        unique=True,
    )
    op.drop_column("lesson_plans", "deleted_at")
    op.drop_column("classes", "deleted_at")
    op.drop_column("subjects", "deleted_at")
    op.drop_column("periods", "deleted_at")
    op.drop_column("holidays", "deleted_at")


def downgrade() -> None:
    op.add_column(
        "holidays",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "periods",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "subjects",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "classes",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "lesson_plans",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.drop_index("uq_lesson_plans_active", table_name="lesson_plans")
    op.create_index(
        "uq_lesson_plans_active",
        "lesson_plans",
        ["user_id", "date", "period_id"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
