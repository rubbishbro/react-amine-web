from typing import Any, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlmodel import Session
from pydantic import BaseModel

from app.crud import crud_user
from app.api import deps
from app.models.user import User
from app.schemas.user import User as UserSchema, UserCreate, UserUpdate

router = APIRouter()

@router.post("/", response_model=UserSchema)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """
    创建用户
    """
    # 检查邮箱是否已存在
    user = crud_user.get_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="该邮箱已被注册",
        )
    # 检查用户名是否已存在
    user = crud_user.get_by_username(db, username=user_in.username)
    if user:
        raise HTTPException(
            status_code=400,
            detail="该用户名已被占用",
        )
    user = crud_user.create(db, obj_in=user_in)
    return user

@router.get("/me", response_model=UserSchema)
def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    获取当前用户
    """
    return current_user

@router.get("/username/{username}", response_model=UserSchema)
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


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    userSchool: Optional[str] = None
    userClass: Optional[str] = None
    bio: Optional[str] = None


@router.patch("/me", response_model=UserSchema)
def update_my_profile(
    payload: ProfileUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    更新当前用户的昵称、学校、班级、个人简介。
    """
    return crud_user.update_profile(
        db,
        user=current_user,
        username=payload.username,
        user_school=payload.userSchool,
        user_class=payload.userClass,
        bio=payload.bio,
    )


class AvatarUpdate(BaseModel):
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None


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
