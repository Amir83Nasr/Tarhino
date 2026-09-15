"""strict hierarchy: periods under class, required links

Revision ID: 9f0a1b2c3d4e
Revises: 9a0b1c2d3e4f
Create Date: 2026-09-14

Tree: school -> class -> {students, class_subjects, periods, lesson_plans}.
subjects stay a per-teacher catalog; "a class's subjects" is the
class_subjects link.

Backfill (option A: incomplete lesson plans are deleted, hard-delete project):
1. Classes without a school get a per-user "مدرسه پیش‌فرض".
2. Each global period is copied into every class of the same user.
3. Plans pointing at a global period are re-pointed to the matching copy in
   their own class (same label + times).
4. Plans still missing class/subject/period are deleted.
5. Leftover global periods are deleted.
6. Columns go NOT NULL; delete behavior becomes CASCADE down the tree.

Downgrade reverses the constraints only; copied rows are left in place.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9f0a1b2c3d4e"
down_revision: str | None = "9a0b1c2d3e4f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DEFAULT_SCHOOL = "مدرسه پیش‌فرض"


def upgrade() -> None:
    # 1. Default school per user that owns school-less classes.
    op.execute(
        sa.text(
            """
            INSERT INTO schools (id, user_id, name)
            SELECT gen_random_uuid(), u.id, :name
            FROM users u
            WHERE EXISTS (
                SELECT 1 FROM classes c
                WHERE c.user_id = u.id AND c.school_id IS NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM schools s
                WHERE s.user_id = u.id AND s.name = :name
            )
            """
        ).bindparams(name=_DEFAULT_SCHOOL)
    )
    op.execute(
        sa.text(
            """
            UPDATE classes c SET school_id = (
                SELECT s.id FROM schools s
                WHERE s.user_id = c.user_id AND s.name = :name
                ORDER BY s.created_at LIMIT 1
            )
            WHERE c.school_id IS NULL
            """
        ).bindparams(name=_DEFAULT_SCHOOL)
    )

    # 2. New column first without constraints; data work below fills it.
    op.add_column("periods", sa.Column("class_id", sa.Uuid(), nullable=True))

    # 3. Copy every global period into each class of the same user.
    op.execute(
        sa.text(
            """
            INSERT INTO periods (id, user_id, class_id, label,
                                 start_time, end_time, order_index)
            SELECT gen_random_uuid(), p.user_id, c.id, p.label,
                   p.start_time, p.end_time, p.order_index
            FROM periods p JOIN classes c ON c.user_id = p.user_id
            WHERE p.class_id IS NULL
            """
        )
    )

    # 4. Re-point classed plans from the global period to their class's copy.
    op.execute(
        sa.text(
            """
            UPDATE lesson_plans lp SET period_id = np.id
            FROM periods op, periods np
            WHERE lp.period_id = op.id
              AND op.class_id IS NULL
              AND lp.class_id IS NOT NULL
              AND np.user_id = op.user_id
              AND np.class_id = lp.class_id
              AND np.label = op.label
              AND np.start_time = op.start_time
              AND np.end_time = op.end_time
            """
        )
    )

    # 5. Incomplete plans cannot satisfy the strict tree: hard-delete.
    op.execute(
        sa.text(
            """
            DELETE FROM lesson_plans
            WHERE class_id IS NULL OR subject_id IS NULL OR period_id IS NULL
            """
        )
    )

    # 6. No plan references global periods anymore.
    op.execute(sa.text("DELETE FROM periods WHERE class_id IS NULL"))

    # 7. Strict columns.
    op.alter_column("classes", "school_id", nullable=False)
    op.alter_column("periods", "class_id", nullable=False)
    op.alter_column("lesson_plans", "class_id", nullable=False)
    op.alter_column("lesson_plans", "subject_id", nullable=False)
    op.alter_column("lesson_plans", "period_id", nullable=False)

    # 8. Deletes cascade down the tree instead of orphaning children.
    op.drop_constraint("classes_school_id_fkey", "classes", type_="foreignkey")
    op.create_foreign_key(None, "classes", "schools", ["school_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key(None, "periods", "classes", ["class_id"], ["id"], ondelete="CASCADE")
    op.drop_constraint("lesson_plans_class_id_fkey", "lesson_plans", type_="foreignkey")
    op.create_foreign_key(None, "lesson_plans", "classes", ["class_id"], ["id"], ondelete="CASCADE")
    op.drop_constraint("lesson_plans_subject_id_fkey", "lesson_plans", type_="foreignkey")
    op.create_foreign_key(
        None, "lesson_plans", "subjects", ["subject_id"], ["id"], ondelete="CASCADE"
    )
    op.drop_constraint("lesson_plans_period_id_fkey", "lesson_plans", type_="foreignkey")
    op.create_foreign_key(
        None, "lesson_plans", "periods", ["period_id"], ["id"], ondelete="CASCADE"
    )

    # 9. Per-class bell schedule lookup.
    op.create_index(op.f("ix_periods_class_id"), "periods", ["class_id"], unique=False)
    op.create_index(
        "ix_periods_user_class_order",
        "periods",
        ["user_id", "class_id", "order_index"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_periods_user_class_order", table_name="periods")
    op.drop_index(op.f("ix_periods_class_id"), table_name="periods")
    op.drop_constraint("periods_class_id_fkey", "periods", type_="foreignkey")
    op.drop_constraint("lesson_plans_period_id_fkey", "lesson_plans", type_="foreignkey")
    op.create_foreign_key(
        None, "lesson_plans", "periods", ["period_id"], ["id"], ondelete="SET NULL"
    )
    op.drop_constraint("lesson_plans_subject_id_fkey", "lesson_plans", type_="foreignkey")
    op.create_foreign_key(
        None, "lesson_plans", "subjects", ["subject_id"], ["id"], ondelete="SET NULL"
    )
    op.drop_constraint("lesson_plans_class_id_fkey", "lesson_plans", type_="foreignkey")
    op.create_foreign_key(
        None, "lesson_plans", "classes", ["class_id"], ["id"], ondelete="SET NULL"
    )
    op.drop_constraint("classes_school_id_fkey", "classes", type_="foreignkey")
    op.create_foreign_key(None, "classes", "schools", ["school_id"], ["id"], ondelete="SET NULL")
    op.alter_column("lesson_plans", "period_id", nullable=True)
    op.alter_column("lesson_plans", "subject_id", nullable=True)
    op.alter_column("lesson_plans", "class_id", nullable=True)
    op.alter_column("periods", "class_id", nullable=True)
    op.alter_column("classes", "school_id", nullable=True)
