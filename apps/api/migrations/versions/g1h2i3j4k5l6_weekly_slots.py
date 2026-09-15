"""weekly timetable template slots

Revision ID: g1h2i3j4k5l6
Revises: f6a7b8c9d0e1
Create Date: 2026-09-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "g1h2i3j4k5l6"
down_revision: str | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "weekly_slots",
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Uuid(), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=False),
        sa.Column("period_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["period_id"], ["periods.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "class_id", "weekday", "period_id", name="uq_weekly_slot_cell"
        ),
    )
    op.create_index(op.f("ix_weekly_slots_class_id"), "weekly_slots", ["class_id"], unique=False)
    op.create_index(op.f("ix_weekly_slots_period_id"), "weekly_slots", ["period_id"], unique=False)
    op.create_index(
        op.f("ix_weekly_slots_subject_id"), "weekly_slots", ["subject_id"], unique=False
    )
    op.create_index(op.f("ix_weekly_slots_user_id"), "weekly_slots", ["user_id"], unique=False)
    op.create_index(
        "ix_weekly_slots_user_class",
        "weekly_slots",
        ["user_id", "class_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_weekly_slots_user_class", table_name="weekly_slots")
    op.drop_index(op.f("ix_weekly_slots_user_id"), table_name="weekly_slots")
    op.drop_index(op.f("ix_weekly_slots_subject_id"), table_name="weekly_slots")
    op.drop_index(op.f("ix_weekly_slots_period_id"), table_name="weekly_slots")
    op.drop_index(op.f("ix_weekly_slots_class_id"), table_name="weekly_slots")
    op.drop_table("weekly_slots")
