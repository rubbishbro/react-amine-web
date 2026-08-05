"""
管理员 API 端点
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query
import secrets
from sqlalchemy import or_
from sqlmodel import Session, select

from app.api import deps
from app.api.deps import get_current_active_user
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


@router.post("/activate", response_model=UserSchema)
def activate_admin(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    secret_key: str = Body(..., embed=True, alias="secret_key"),
) -> Any:
    """
    用管理员密钥激活当前用户的管理员权限。
    正确密钥 → 将 is_superuser 设为 True 并返回更新后的用户。
    错误密钥 → 422 错误。
    """
    from app.core.config import settings
    if len(secret_key) > 256 or not secrets.compare_digest(secret_key, settings.ADMIN_SECRET_KEY):
        raise HTTPException(status_code=422, detail="无效的密钥")
    current_user.is_superuser = True
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user



@router.get("/users", response_model=List[UserSchema])
def list_users(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_superuser),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    q: Optional[str] = Query(default=None, max_length=100),
) -> Any:
    """
    获取用户列表（仅管理员）
    支持通过 q 参数按昵称/邮箱模糊搜索。
    """
    statement = select(User)
    keyword = (q or "").strip()
    if keyword:
        pattern = f"%{keyword}%"
        statement = statement.where(
            or_(User.username.ilike(pattern), User.email.ilike(pattern))
        )

    users = db.exec(statement.offset(skip).limit(limit)).all()
    return users


@router.put("/users/{user_id}/title", response_model=UserSchema)
def set_user_title(
    *,
    db: Session = Depends(deps.get_db),
    user_id: int,
    request: SetTitleRequest,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """
    设置用户头衔（仅管理员）。
    管理员可修改自己或普通用户的头衔，不能修改其他管理员的头衔。
    """
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")
    # 不能修改其他管理员的头衔（可以修改自己的）
    if target.is_superuser and target.id != current_user.id:
        raise HTTPException(status_code=403, detail="不能修改其他管理员的头衔")
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
