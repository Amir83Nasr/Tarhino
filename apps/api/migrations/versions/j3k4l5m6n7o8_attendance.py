"""daily student attendance

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "j3k4l5m6n7o8"
down_revision: str | None = "i2j3k4l5m6n7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "attendances",
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("class_id", sa.Uuid(), nullable=False),
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="present"),
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
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", "student_id", name="uq_attendance_day_student"),
    )
    op.create_index(op.f("ix_attendances_class_id"), "attendances", ["class_id"], unique=False)
    op.create_index(op.f("ix_attendances_student_id"), "attendances", ["student_id"], unique=False)
    op.create_index(op.f("ix_attendances_user_id"), "attendances", ["user_id"], unique=False)
    op.create_index(
        "ix_attendance_user_class_date",
        "attendances",
        ["user_id", "class_id", "date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_attendance_user_class_date", table_name="attendances")
    op.drop_index(op.f("ix_attendances_user_id"), table_name="attendances")
    op.drop_index(op.f("ix_attendances_student_id"), table_name="attendances")
    op.drop_index(op.f("ix_attendances_class_id"), table_name="attendances")
    op.drop_table("attendances")
