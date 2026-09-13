"""schools, students, assessments, grades

Revision ID: 4b5c6d7e8f09
Revises: 3a7f2c1d9e04
Create Date: 2026-09-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "4b5c6d7e8f09"
down_revision: str | None = "3a7f2c1d9e04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "schools",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=32), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schools_user_id"), "schools", ["user_id"], unique=False)

    op.add_column("classes", sa.Column("school_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(None, "classes", "schools", ["school_id"], ["id"], ondelete="SET NULL")

    op.create_table(
        "students",
        sa.Column("class_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_students_class_id"), "students", ["class_id"], unique=False)
    op.create_index(op.f("ix_students_user_id"), "students", ["user_id"], unique=False)
    op.create_index("ix_students_user_class", "students", ["user_id", "class_id"], unique=False)

    op.create_table(
        "assessments",
        sa.Column("subject_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("weight", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
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
    )
    op.create_index(op.f("ix_assessments_subject_id"), "assessments", ["subject_id"], unique=False)
    op.create_index(op.f("ix_assessments_user_id"), "assessments", ["user_id"], unique=False)
    op.create_index(
        "ix_assessments_user_subject", "assessments", ["user_id", "subject_id"], unique=False
    )

    op.create_table(
        "grades",
        sa.Column("student_id", sa.Uuid(), nullable=False),
        sa.Column("assessment_id", sa.Uuid(), nullable=False),
        sa.Column("value", sa.Numeric(precision=5, scale=2), nullable=False),
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
        sa.ForeignKeyConstraint(["assessment_id"], ["assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "student_id", "assessment_id", name="uq_grade_cell"),
    )
    op.create_index(op.f("ix_grades_assessment_id"), "grades", ["assessment_id"], unique=False)
    op.create_index(op.f("ix_grades_student_id"), "grades", ["student_id"], unique=False)
    op.create_index(op.f("ix_grades_user_id"), "grades", ["user_id"], unique=False)
    op.create_index(
        "ix_grades_user_assessment", "grades", ["user_id", "assessment_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_grades_user_assessment", table_name="grades")
    op.drop_index(op.f("ix_grades_user_id"), table_name="grades")
    op.drop_index(op.f("ix_grades_student_id"), table_name="grades")
    op.drop_index(op.f("ix_grades_assessment_id"), table_name="grades")
    op.drop_table("grades")
    op.drop_index("ix_assessments_user_subject", table_name="assessments")
    op.drop_index(op.f("ix_assessments_user_id"), table_name="assessments")
    op.drop_index(op.f("ix_assessments_subject_id"), table_name="assessments")
    op.drop_table("assessments")
    op.drop_index("ix_students_user_class", table_name="students")
    op.drop_index(op.f("ix_students_user_id"), table_name="students")
    op.drop_index(op.f("ix_students_class_id"), table_name="students")
    op.drop_table("students")
    op.drop_constraint(None, "classes", type_="foreignkey")
    op.drop_column("classes", "school_id")
    op.drop_index(op.f("ix_schools_user_id"), table_name="schools")
    op.drop_table("schools")
