import pytest

from app.main import API_PREFIX, app


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

    for resource in ("classes", "subjects", "periods", "lesson-plans", "holidays"):
        assert f"{API_PREFIX}/{resource}" in paths
        assert f"{API_PREFIX}/{resource}/{{item_id}}" in paths


def test_lesson_plan_rejects_inverted_period_times() -> None:
    from pydantic import ValidationError

    from app.schemas.teaching import PeriodCreate

    PeriodCreate(label="زنگ اول", start_time="08:00", end_time="09:30")

    with pytest.raises(ValidationError):
        PeriodCreate(label="بد", start_time="09:30", end_time="08:00")


def test_users_me_requires_bearer_auth() -> None:
    schema = app.openapi()
    me = schema["paths"][f"{API_PREFIX}/users/me"]["get"]

    assert me["security"] == [{"HTTPBearer": []}]
