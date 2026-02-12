"""
管理员 API 端点
"""
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session

from app.api import deps
from app.crud import crud_admin
from app.models.user import User
from app.schemas.user import (
    User as UserSchema,
    SetTitleRequest,
    SetRoleRequest,
    MuteUserRequest,
    BanUserRequest,
)

router = APIRouter()


@router.put("/users/{user_id}/title", response_model=UserSchema)
def set_user_title(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    request: SetTitleRequest,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    设置用户头衔（仅管理员）
    """
    user = crud_admin.admin.set_title(db, user_id=user_id, title=request.title)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.put("/users/{user_id}/role", response_model=UserSchema)
def set_user_role(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    request: SetRoleRequest,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    设置用户权限（仅管理员）
    """
    # 不能修改自己的权限
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能修改自己的权限")
    
    user = crud_admin.admin.set_role(db, user_id=user_id, is_superuser=request.is_superuser)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("/users/{user_id}/mute", response_model=UserSchema)
def mute_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    request: MuteUserRequest,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    禁言用户（仅管理员）
    """
    # 不能禁言自己
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能禁言自己")
    
    user = crud_admin.admin.mute_user(db, user_id=user_id, reason=request.reason)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在或无法禁言管理员")
    return user


@router.delete("/users/{user_id}/mute", response_model=UserSchema)
def unmute_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    取消禁言（仅管理员）
    """
    user = crud_admin.admin.unmute_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("/users/{user_id}/ban", response_model=UserSchema)
def ban_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    request: BanUserRequest,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    封禁用户（仅管理员）
    """
    # 不能封禁自己
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能封禁自己")
    
    user = crud_admin.admin.ban_user(db, user_id=user_id, reason=request.reason)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在或无法封禁管理员")
    return user


@router.delete("/users/{user_id}/ban", response_model=UserSchema)
def unban_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    取消封禁（仅管理员）
    """
    user = crud_admin.admin.unban_user(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.delete("/users/{user_id}")
def delete_user(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    删除用户（仅管理员，不能删除管理员）
    """
    # 不能删除自己
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    
    success = crud_admin.admin.delete_user(db, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="用户不存在或无法删除管理员")
    return {"message": "用户已删除"}


@router.get("/users/{user_id}", response_model=UserSchema)
def get_user_admin_info(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    获取用户完整信息（仅管理员）
    """
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user
