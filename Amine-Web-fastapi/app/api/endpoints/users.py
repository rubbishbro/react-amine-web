from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel, ConfigDict, Field, field_validator
from urllib.parse import urlparse
import re
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from app.crud import crud_user
from app.api import deps
from app.models.user import User
from app.schemas.user import User as UserSchema, UserPublic
from app.core.config import settings

router = APIRouter()

@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    获取当前用户
    """
    return current_user

@router.get("/username/{username}", response_model=UserPublic)
def read_user_by_username(
    username: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    根据用户名获取用户公开信息（无需登录）
    """
    user = crud_user.get_by_username(db, username=username)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="该用户名不存在",
        )
    return user


def _validate_media_url(value: Optional[str]) -> Optional[str]:
    if value is None or value == "":
        return value
    if len(value) > 500 or "\x00" in value:
        raise ValueError("invalid media URL")

    local_pattern = re.compile(
        r"^/static/uploads/[0-9a-f]{32}\.(?:jpg|jpeg|png|gif|mp3|wav|mp4)$",
        re.IGNORECASE,
    )
    if local_pattern.fullmatch(value):
        return value

    parsed = urlparse(value)
    allowed_hosts = {"api.lnssy-cykj.online"}
    if settings.QINIU_DOMAIN:
        qiniu_host = urlparse(settings.QINIU_DOMAIN).hostname
        if qiniu_host:
            allowed_hosts.add(qiniu_host)
    if settings.ENVIRONMENT.lower() != "production":
        allowed_hosts.update({"localhost", "127.0.0.1", "testserver"})

    if parsed.scheme not in {"https", "http"} or parsed.hostname not in allowed_hosts:
        raise ValueError("media URL host is not allowed")
    if parsed.scheme == "http" and settings.ENVIRONMENT.lower() == "production":
        raise ValueError("media URL must use HTTPS")
    if parsed.hostname == "api.lnssy-cykj.online" and not local_pattern.fullmatch(parsed.path):
        raise ValueError("invalid local media path")
    return value


class ProfileUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=50)
    userSchool: Optional[str] = Field(default=None, max_length=200)
    userClass: Optional[str] = Field(default=None, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=500)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    cover_url: Optional[str] = Field(default=None, max_length=500)

    model_config = ConfigDict(extra="forbid")

    @field_validator("username", "userSchool", "userClass", "bio")
    @classmethod
    def reject_unsafe_characters(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if "\x00" in value or any(ord(char) < 32 and char not in "\t\n\r" for char in value):
            raise ValueError("control characters are not allowed")
        return value

    @field_validator("avatar_url", "cover_url")
    @classmethod
    def validate_media_url(cls, value: Optional[str]) -> Optional[str]:
        return _validate_media_url(value)


@router.patch("/me", response_model=UserSchema)
def update_my_profile(
    payload: ProfileUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    更新当前用户的昵称、学校、班级、个人简介。
    """
    fields = payload.model_fields_set
    if "username" in fields:
        username = (payload.username or "").strip()
        if not username:
            raise HTTPException(status_code=422, detail="Username cannot be empty")
        existing = crud_user.get_by_username(db, username=username)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=409, detail="Username already exists")
        current_user.username = username
    if "userSchool" in fields:
        current_user.userSchool = payload.userSchool or None
    if "userClass" in fields:
        current_user.userClass = payload.userClass or None
    if "bio" in fields:
        current_user.bio = payload.bio or None
    if "avatar_url" in fields:
        current_user.avatar_url = payload.avatar_url or None
    if "cover_url" in fields:
        current_user.cover_url = payload.cover_url or None
    current_user.updated_at = datetime.utcnow()
    db.add(current_user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists") from error
    db.refresh(current_user)
    return current_user


class AvatarUpdate(BaseModel):
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("avatar_url", "cover_url")
    @classmethod
    def validate_media_url(cls, value: Optional[str]) -> Optional[str]:
        return _validate_media_url(value)


@router.patch("/me/avatar", response_model=UserSchema)
def update_my_avatar(
    payload: AvatarUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    更新当前用户的头像和头图 URL（七牛 CDN 或本地路径）。
    """
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    if payload.cover_url is not None:
        current_user.cover_url = payload.cover_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
