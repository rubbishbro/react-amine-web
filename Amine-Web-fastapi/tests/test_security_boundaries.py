import asyncio
from io import BytesIO

import pytest
from fastapi import UploadFile
from pydantic import ValidationError
from starlette.requests import Request

from app.api.endpoints.dm import SendMessageIn
from app.api.endpoints.dm_upload import _normalize_key
from app.api.endpoints.users import AvatarUpdate, ProfileUpdate
from app.core.file_validation import validate_media_upload
from app.core.request_limits import _policy_for
from app.schemas.post import PostCreate


PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c02"
    "0000000b4944415478da6364f80f00010501012718e3660000000049454e44ae426082"
)


def request_for(path: str, method: str = "GET") -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": method,
            "scheme": "https",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "client": ("203.0.113.8", 1234),
            "server": ("testserver", 443),
        }
    )


def test_every_api_request_receives_a_policy():
    assert _policy_for(request_for("/api/v1/posts")).name == "read"
    assert _policy_for(request_for("/api/v1/search/all")).name == "search"
    assert _policy_for(request_for("/api/v1/posts", "POST")).name == "post_create"
    assert _policy_for(request_for("/api/v1/dm/send", "POST")).name == "dm_send"


def test_post_and_profile_reject_oversized_or_extra_fields():
    with pytest.raises(ValidationError):
        PostCreate(
            title="x" * 121,
            content="body",
            tags=[],
            is_published=True,
        )
    with pytest.raises(ValidationError):
        ProfileUpdate(username="safe", is_superuser=True)
    with pytest.raises(ValidationError):
        SendMessageIn(receiver_id=1, content="x" * 2001)


def test_media_url_and_dm_key_are_allowlisted():
    assert AvatarUpdate(avatar_url="/static/uploads/" + "a" * 32 + ".png")
    with pytest.raises(ValidationError):
        AvatarUpdate(avatar_url="file:///etc/passwd")
    with pytest.raises(ValidationError):
        AvatarUpdate(avatar_url="https://evil.example/tracker.png")
    assert _normalize_key("dm_upload/" + "b" * 32 + ".png")[1].endswith(".png")
    with pytest.raises(Exception):
        _normalize_key("dm_upload/../../.env")


def test_upload_checks_file_content_and_strips_trailing_payload():
    valid = UploadFile(filename="pixel.png", file=BytesIO(PNG_1X1 + b"TRAILING"))
    media = asyncio.run(validate_media_upload(valid, 1024 * 1024))
    assert media.extension == ".png"
    assert b"TRAILING" not in media.data

    spoofed = UploadFile(filename="fake.png", file=BytesIO(b"<?php echo 1; ?>"))
    with pytest.raises(Exception):
        asyncio.run(validate_media_upload(spoofed, 1024 * 1024))
