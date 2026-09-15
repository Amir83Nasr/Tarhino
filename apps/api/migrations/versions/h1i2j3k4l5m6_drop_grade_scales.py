"""drop per-subject grade scales (fixed bands now)

Revision ID: h1i2j3k4l5m6
Revises: g1h2i3j4k5l6
Create Date: 2026-09-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "h1i2j3k4l5m6"
down_revision: str | None = "g1h2i3j4k5l6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_grade_scales_user_id"), table_name="grade_scales")
    op.drop_index(op.f("ix_grade_scales_subject_id"), table_name="grade_scales")
    op.drop_table("grade_scales")


def downgrade() -> None:
    op.create_table(
        "grade_scales",
        sa.Column("subject_id", sa.Uuid(), nullable=False),
        sa.Column("excellent_min", sa.Numeric(5, 2), nullable=False, server_default="18"),
        sa.Column("good_min", sa.Numeric(5, 2), nullable=False, server_default="15"),
        sa.Column("pass_min", sa.Numeric(5, 2), nullable=False, server_default="10"),
        sa.Column(
            "excellent_label", sa.String(length=100), nullable=False, server_default="خیلی خوب"
        ),
        sa.Column("good_label", sa.String(length=100), nullable=False, server_default="خوب"),
        sa.Column("fair_label", sa.String(length=100), nullable=False, server_default="قابل قبول"),
        sa.Column(
            "needs_label",
            sa.String(length=100),
            nullable=False,
            server_default="نیازمند تلاش بیشتر",
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "subject_id", name="uq_grade_scale_subject"),
    )
    op.create_index(
        op.f("ix_grade_scales_subject_id"), "grade_scales", ["subject_id"], unique=False
    )
    op.create_index(op.f("ix_grade_scales_user_id"), "grade_scales", ["user_id"], unique=False)
