import pytest
from pydantic import ValidationError

from app.main import API_PREFIX, app
from app.teaching.router import BulkCreate


def test_public_and_protected_routes_are_registered() -> None:
    # Assert against the OpenAPI schema, not app.routes: this FastAPI version wraps
    # include_router output in _IncludedRouter objects that carry no .path.
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/auth/register" in paths
    assert f"{API_PREFIX}/auth/login" in paths
    assert f"{API_PREFIX}/auth/refresh" in paths
    assert f"{API_PREFIX}/auth/logout" in paths
    assert f"{API_PREFIX}/users/me" in paths
    assert "/health" in paths


def test_teaching_resources_are_registered() -> None:
    paths = set(app.openapi()["paths"])

    for resource in (
        "classes",
        "subjects",
        "class-subjects",
        "periods",
        "lesson-plans",
        "holidays",
        "weekly-slots",
    ):
        assert f"{API_PREFIX}/{resource}" in paths
        assert f"{API_PREFIX}/{resource}/{{item_id}}" in paths


def test_weekly_slot_scoped_lookups_are_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/weekly-slots/by-class/{{class_id}}" in paths
    assert f"{API_PREFIX}/lesson-plans/ensure-week" in paths
    assert f"{API_PREFIX}/weekly-slots/apply" not in paths


def test_weekly_slot_rejects_out_of_range_weekday() -> None:
    import uuid

    from app.schemas.teaching import WeeklySlotCreate

    ids = {"class_id": uuid.uuid4(), "subject_id": uuid.uuid4(), "period_id": uuid.uuid4()}
    WeeklySlotCreate(weekday=0, **ids)
    WeeklySlotCreate(weekday=4, **ids)

    with pytest.raises(ValidationError):
        WeeklySlotCreate(weekday=5, **ids)

    with pytest.raises(ValidationError):
        WeeklySlotCreate(weekday=-1, **ids)


def test_class_subject_scoped_lookups_are_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/class-subjects/by-class/{{class_id}}" in paths
    assert f"{API_PREFIX}/class-subjects/by-subject/{{subject_id}}" in paths


def test_lesson_plan_rejects_inverted_period_times() -> None:
    from pydantic import ValidationError

    from app.schemas.teaching import PeriodCreate

    PeriodCreate(
        class_id="c1f0f6a0-0000-4000-8000-000000000001",
        label="زنگ اول",
        start_time="08:00",
        end_time="09:30",
    )

    with pytest.raises(ValidationError):
        PeriodCreate(
            class_id="c1f0f6a0-0000-4000-8000-000000000001",
            label="بد",
            start_time="09:30",
            end_time="08:00",
        )


def test_strict_hierarchy_requires_parents() -> None:
    """school -> class -> {period, lesson plan}: no orphans, no school-less class."""
    import uuid

    from pydantic import ValidationError

    from app.schemas.teaching import (
        ClassCreate,
        LessonPlanCreate,
        PeriodCreate,
    )

    with pytest.raises(ValidationError):
        ClassCreate(name="هفتم الف")  # type: ignore[call-arg]
    with pytest.raises(ValidationError):
        PeriodCreate(label="زنگ اول", start_time="08:00", end_time="09:30")  # type: ignore[call-arg]

    with pytest.raises(ValidationError):
        LessonPlanCreate(date="2026-09-14", activity="تمرین")  # type: ignore[call-arg]

    school_id = uuid.uuid4()
    ClassCreate(name="هفتم الف", school_id=school_id)
    PeriodCreate(
        class_id=uuid.uuid4(),
        label="زنگ اول",
        start_time="08:00",
        end_time="09:30",
    )
    LessonPlanCreate(
        date="2026-09-14",
        activity="تمرین",
        class_id=uuid.uuid4(),
        subject_id=uuid.uuid4(),
        period_id=uuid.uuid4(),
    )


def test_periods_by_class_is_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/periods/by-class/{{class_id}}" in paths


def test_bulk_still_rejects_empty_and_overlong() -> None:
    from pydantic import ValidationError

    from app.teaching.router import BulkCreate

    item = {
        "date": "2026-09-14",
        "activity": "بازی",
        "class_id": "c1f0f6a0-0000-4000-8000-000000000001",
        "subject_id": "c1f0f6a0-0000-4000-8000-000000000002",
        "period_id": "c1f0f6a0-0000-4000-8000-000000000003",
    }

    with pytest.raises(ValidationError):
        BulkCreate(items=[])

    with pytest.raises(ValidationError):
        BulkCreate(items=[item] * 21)

    assert len(BulkCreate(items=[item] * 2).items) == 2


def test_descriptive_grading_mode_endpoint_is_gone() -> None:
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/users/me/grading-mode" not in paths


def test_grade_upsert_accepts_level_for_descriptive_mode() -> None:
    import uuid

    from app.schemas.teaching import GradeUpsert

    GradeUpsert(
        student_id=uuid.uuid4(),
        assessment_id=uuid.uuid4(),
        level="خیلی خوب",
    )

    # Descriptive-only: callers send level, the router rejects numeric value.


def test_users_me_requires_bearer_auth() -> None:
    schema = app.openapi()
    me = schema["paths"][f"{API_PREFIX}/users/me"]["get"]

    assert me["security"] == [{"HTTPBearer": []}]


def test_lesson_plan_bulk_is_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/lesson-plans/bulk" in paths


def test_lesson_plan_bulk_rejects_empty_and_overlong() -> None:
    item = {
        "date": "2026-09-14",
        "activity": "بازی",
        "class_id": "c1f0f6a0-0000-4000-8000-000000000001",
        "subject_id": "c1f0f6a0-0000-4000-8000-000000000002",
        "period_id": "c1f0f6a0-0000-4000-8000-000000000003",
    }

    with pytest.raises(ValidationError):
        BulkCreate(items=[])

    with pytest.raises(ValidationError):
        BulkCreate(items=[item] * 21)

    assert len(BulkCreate(items=[item] * 2).items) == 2


def test_users_account_routes_are_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/users/me/sessions" in paths
    assert f"{API_PREFIX}/users/me/sessions/revoke-others" in paths
    assert f"{API_PREFIX}/users/me/data" in paths


def test_user_update_rejects_blank_names() -> None:
    from pydantic import ValidationError

    from app.schemas.user import UserUpdate

    with pytest.raises(ValidationError):
        UserUpdate(first_name="")


def test_change_password_requires_long_new_password() -> None:
    from pydantic import ValidationError

    from app.schemas.user import ChangePasswordRequest

    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="x", new_password="short")


def test_elementary_setup_is_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert f"{API_PREFIX}/classes/elementary-setup" in paths


def test_elementary_presets_cover_grades_and_shifts() -> None:
    from app.schemas.teaching import ElementarySetupCreate
    from app.teaching.elementary import (
        ELEMENTARY_GRADES,
        ELEMENTARY_SUBJECTS,
        SHIFT_PERIODS,
        SHIFTS,
    )

    assert len(ELEMENTARY_GRADES) == 6
    assert set(ELEMENTARY_SUBJECTS) == set(ELEMENTARY_GRADES)
    for subjects in ELEMENTARY_SUBJECTS.values():
        assert len(subjects) >= 6  # core + sport/art minimum
    for bells in SHIFT_PERIODS.values():
        assert len(bells) == 5  # 5 bells/day
    assert set(SHIFTS) == {"morning", "afternoon", "rotating"}

    row = ElementarySetupCreate(school_name="قیام", grade="پایه اول", shift="morning")
    assert row.shift == "morning"
    with pytest.raises(ValidationError):
        ElementarySetupCreate(school_name="قیام", shift="morning")  # type: ignore[call-arg]


def test_effective_shift_alternates_weekly_for_rotating() -> None:
    import datetime as dt

    from app.teaching.elementary import effective_shift, saturday_of

    anchor = saturday_of(dt.date(2026, 9, 12))
    assert effective_shift("morning", None, anchor) == "morning"
    assert effective_shift("afternoon", None, anchor) == "afternoon"
    assert effective_shift("rotating", anchor, anchor) == "morning"
    assert effective_shift("rotating", anchor, anchor + dt.timedelta(days=7)) == "afternoon"
    assert effective_shift("rotating", anchor, anchor + dt.timedelta(days=14)) == "morning"
    assert saturday_of(dt.date(2026, 9, 13)).weekday() == 5  # Sunday -> Saturday
