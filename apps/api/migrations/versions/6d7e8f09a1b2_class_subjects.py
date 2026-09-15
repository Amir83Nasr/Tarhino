"""class_subjects link table with backfill

Revision ID: 6d7e8f09a1b2
Revises: 5c6d7e8f09a1
Create Date: 2026-09-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6d7e8f09a1b2"
down_revision: str | None = "5c6d7e8f09a1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "class_subjects",
        sa.Column("class_id", sa.Uuid(), nullable=False),
        sa.Column("subject_id", sa.Uuid(), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "class_id", "subject_id", name="uq_class_subject_cell"),
    )
    op.create_index(
        op.f("ix_class_subjects_class_id"), "class_subjects", ["class_id"], unique=False
    )
    op.create_index(
        op.f("ix_class_subjects_subject_id"),
        "class_subjects",
        ["subject_id"],
        unique=False,
    )
    op.create_index(op.f("ix_class_subjects_user_id"), "class_subjects", ["user_id"], unique=False)
    op.create_index(
        "ix_class_subjects_user_class",
        "class_subjects",
        ["user_id", "class_id"],
        unique=False,
    )
    # Backfill: subjects were global per teacher, so link every class to every
    # subject of the same user. Teachers trim links in settings afterwards.
    op.execute(
        sa.text(
            """
            INSERT INTO class_subjects (id, user_id, class_id, subject_id)
            SELECT gen_random_uuid(), c.user_id, c.id, s.id
            FROM classes c JOIN subjects s ON s.user_id = c.user_id
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_class_subjects_user_class", table_name="class_subjects")
    op.drop_index(op.f("ix_class_subjects_user_id"), table_name="class_subjects")
    op.drop_index(op.f("ix_class_subjects_subject_id"), table_name="class_subjects")
    op.drop_index(op.f("ix_class_subjects_class_id"), table_name="class_subjects")
    op.drop_table("class_subjects")
