"""grade scales per subject + stored grade labels

Revision ID: 9a0b1c2d3e4f
Revises: 7e8f09a1b2c3
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9a0b1c2d3e4f"
down_revision: str | None = "7e8f09a1b2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
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
    op.add_column(
        "grades",
        sa.Column("label", sa.String(length=100), nullable=False, server_default=""),
    )
    # Backfill stored labels with the default bands (server-side CASE, no ORM).
    op.execute(
        sa.text(
            """
            UPDATE grades SET label = CASE
                WHEN value >= 18 THEN 'خیلی خوب'
                WHEN value >= 15 THEN 'خوب'
                WHEN value >= 10 THEN 'قابل قبول'
                ELSE 'نیازمند تلاش بیشتر'
            END
            """
        )
    )


def downgrade() -> None:
    op.drop_column("grades", "label")
    op.drop_index(op.f("ix_grade_scales_user_id"), table_name="grade_scales")
    op.drop_index(op.f("ix_grade_scales_subject_id"), table_name="grade_scales")
    op.drop_table("grade_scales")
