from app.main import API_PREFIX, app


def test_ai_settings_routes_are_gone() -> None:
    paths = set(app.openapi()["paths"])
    assert f"{API_PREFIX}/ai/settings" not in paths
    assert f"{API_PREFIX}/ai/settings/key" not in paths


def test_ai_chat_route_is_registered() -> None:
    paths = set(app.openapi()["paths"])
    assert f"{API_PREFIX}/ai/chat" in paths
