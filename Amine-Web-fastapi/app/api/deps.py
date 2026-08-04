# 依赖注入和鉴权的核心
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlmodel import Session

from app import models
from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.schemas.token import TokenPayload
from app.models.user import User

# 规定OAuth2的token获取路径
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)
optional_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False
)


def _decode_user(db: Session, token: str) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        user_id = int(token_data.sub)
    except (JWTError, ValidationError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# 获取当前用户
def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    return _decode_user(db, token)


def get_optional_current_user(
    db: Session = Depends(get_db), token: Optional[str] = Depends(optional_oauth2)
) -> Optional[User]:
    if not token:
        return None
    return _decode_user(db, token)

# 是否激活当前用户
def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if current_user.is_banned:
        raise HTTPException(status_code=403, detail="Account is banned")
    return current_user

def get_current_superuser(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """验证当前用户是否为管理员"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="没有管理员权限"
        )
    return current_user

def check_not_banned(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """验证用户是否被封禁"""
    if current_user.is_banned:
        raise HTTPException(
            status_code=403,
            detail="账号已被封禁，无法访问"
        )
    return current_user

def check_not_muted(
    current_user: User = Depends(check_not_banned),
) -> User:
    """验证用户是否被禁言"""
    if current_user.is_muted:
        raise HTTPException(
            status_code=403,
            detail="账号已被禁言，无法发布内容"
        )
    return current_user
