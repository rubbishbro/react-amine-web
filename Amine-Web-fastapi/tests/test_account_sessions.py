import asyncio
from types import SimpleNamespace

from passlib.context import CryptContext
from starlette.requests import Request
from starlette.responses import Response

from app.core import security
from app.core.csrf import CSRFMiddleware
from app.core.session_store import AuthSessionStore
from app.api.endpoints import auth
from app.api.endpoints.users import ProfileUpdate, update_my_profile
from app.crud import crud_user


def _request(method="POST", headers=None, path="/api/v1/users/me"):
    raw_headers = [
        (key.lower().encode(), value.encode()) for key, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "https",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": raw_headers,
            "client": ("203.0.113.10", 1234),
            "server": ("testserver", 443),
        }
    )


def test_argon2_uses_the_full_password_and_legacy_bcrypt_remains_compatible():
    prefix = "A9a" + "x" * 69
    first = prefix + "first-tail"
    second = prefix + "second-tail"
    hashed = security.get_password_hash(first)

    assert hashed.startswith("$argon2id$")
    assert security.verify_password(first, hashed)
    assert not security.verify_password(second, hashed)
    assert not security.password_hash_needs_upgrade(hashed)

    legacy = CryptContext(schemes=["bcrypt"]).hash(first[:72])
    assert security.verify_password(second, legacy)
    assert security.password_hash_needs_upgrade(legacy)


def test_session_refresh_rotation_and_replay_revoke(monkeypatch):
    monkeypatch.setattr("app.core.session_store.settings.REDIS_URL", "")
    store = AuthSessionStore()
    original = store.create(42)

    rotated = store.rotate(original.refresh_token)
    assert rotated.sid == original.sid
    assert rotated.refresh_token != original.refresh_token
    assert store.validate(rotated.sid, 42)

    try:
        store.rotate(original.refresh_token)
        assert False, "replayed refresh token must fail"
    except ValueError:
        pass
    assert not store.validate(rotated.sid, 42)


def test_session_access_token_has_bound_claims(monkeypatch):
    token = security.create_access_token({"sub": "7"}, session_id="session-7")
    payload = security.decode_access_token(token, require_session=True)
    assert payload["sid"] == "session-7"
    assert payload["jti"]
    assert payload["iat"]
    assert payload["iss"]
    assert payload["aud"]

    legacy = security.create_access_token({"sub": "7"})
    assert security.decode_access_token(legacy)["sub"] == "7"


def test_production_session_cookies_have_expected_security_attributes(monkeypatch):
    monkeypatch.setattr(auth.settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(auth.settings, "COOKIE_DOMAIN", ".lnssy-cykj.online")
    response = Response()
    browser_session = SimpleNamespace(
        sid="sid", user_id=9, refresh_token="sid.refresh", csrf_token="csrf"
    )
    auth._set_session_cookies(response, browser_session)
    cookies = response.headers.getlist("set-cookie")

    access = next(value for value in cookies if value.startswith("aw_access_token="))
    refresh = next(value for value in cookies if value.startswith("aw_refresh_token="))
    csrf = next(value for value in cookies if value.startswith("aw_csrf_token="))
    assert "HttpOnly" in access and "Secure" in access and "SameSite=lax" in access
    assert "Path=/api/v1" in access and "Domain=.lnssy-cykj.online" in access
    assert "HttpOnly" in refresh and "Path=/api/v1/auth" in refresh
    assert "HttpOnly" not in csrf and "Path=/" in csrf


def test_cookie_write_requires_matching_origin_and_csrf(monkeypatch):
    middleware = CSRFMiddleware(lambda *_args, **_kwargs: None)

    monkeypatch.setattr(
        "app.core.csrf.security.decode_access_token",
        lambda _token: {"sid": "sid-1"},
    )
    monkeypatch.setattr(
        "app.core.csrf.session_store.verify_csrf",
        lambda sid, token: sid == "sid-1" and token == "csrf-1",
    )

    async def ok(_request):
        return Response(status_code=204)

    missing = _request(
        headers={
            "Origin": "https://www.lnssy-cykj.online",
            "Cookie": "aw_access_token=token; aw_csrf_token=csrf-1",
        }
    )
    rejected = asyncio.run(middleware.dispatch(missing, ok))
    assert rejected.status_code == 403

    valid = _request(
        headers={
            "Origin": "https://www.lnssy-cykj.online",
            "Cookie": "aw_access_token=token; aw_csrf_token=csrf-1",
            "X-CSRF-Token": "csrf-1",
        }
    )
    accepted = asyncio.run(middleware.dispatch(valid, ok))
    assert accepted.status_code == 204

    bearer = _request(headers={"Authorization": "Bearer legacy-token"})
    bearer_accepted = asyncio.run(middleware.dispatch(bearer, ok))
    assert bearer_accepted.status_code == 204

    old_refresh_pair = _request(
        path="/api/v1/auth/refresh",
        headers={
            "Origin": "https://www.lnssy-cykj.online",
            "Cookie": "aw_refresh_token=sid.old; aw_csrf_token=old-csrf",
            "X-CSRF-Token": "old-csrf",
        },
    )
    replay_reaches_rotation = asyncio.run(middleware.dispatch(old_refresh_pair, ok))
    assert replay_reaches_rotation.status_code == 204


def test_email_login_is_case_insensitive_and_upgrades_legacy_hash(monkeypatch):
    password = "LegacyPassword9A"
    user = SimpleNamespace(
        id=5,
        email="member@example.com",
        username="Member",
        hashed_password=CryptContext(schemes=["bcrypt"]).hash(password),
    )

    class FakeDb:
        def add(self, _value):
            pass

        def commit(self):
            pass

        def refresh(self, _value):
            pass

    monkeypatch.setattr(
        crud_user,
        "get_by_email",
        lambda _db, *, email: user if email == "member@example.com" else None,
    )
    monkeypatch.setattr(crud_user, "get_by_username", lambda *_args, **_kwargs: None)

    authenticated = crud_user.authenticate_flexible(
        FakeDb(), identifier="  MEMBER@EXAMPLE.COM ", password=password
    )
    assert authenticated is user
    assert user.hashed_password.startswith("$argon2id$")


def test_profile_patch_clears_optional_fields_and_media_atomically():
    user = SimpleNamespace(
        id=3,
        username="member",
        userSchool="old school",
        userClass="old class",
        bio="old bio",
        avatar_url="/static/uploads/" + "a" * 32 + ".png",
        cover_url="/static/uploads/" + "b" * 32 + ".png",
        updated_at=None,
    )

    class FakeDb:
        def add(self, _value):
            pass

        def commit(self):
            pass

        def rollback(self):
            pass

        def refresh(self, _value):
            pass

    result = update_my_profile(
        ProfileUpdate(
            userSchool="", userClass="", bio="", avatar_url="", cover_url=""
        ),
        db=FakeDb(),
        current_user=user,
    )
    assert result.userSchool is None
    assert result.userClass is None
    assert result.bio is None
    assert result.avatar_url is None
    assert result.cover_url is None
