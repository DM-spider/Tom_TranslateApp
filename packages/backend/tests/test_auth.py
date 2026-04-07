from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.routers.auth import RegisterRequest


def test_register_request_normalizes_email() -> None:
    payload = RegisterRequest(email="  Foo.Bar@Example.COM  ", password="secret123")

    assert payload.email == "foo.bar@example.com"


def test_register_rejects_duplicate_email_ignoring_case() -> None:
    email = f"case-{uuid4().hex[:8]}@example.com"

    with TestClient(app) as client:
        first = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "secret123"},
        )
        second = client.post(
            "/api/v1/auth/register",
            json={"email": email.upper(), "password": "secret123"},
        )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"] == "该邮箱已注册"