# 依赖注入和鉴权的核心
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from app import models
from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.core.session_store import SessionUnavailable, session_store

# 规定OAuth2的token获取路径
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)
optional_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token", auto_error=False
)


def _decode_user(db: Session, token: str, *, require_session: bool = False) -> User:
    try:
        payload = security.decode_access_token(token, require_session=require_session)
        user_id = int(payload.get("sub"))
        sid = payload.get("sid")
        if require_session and not session_store.validate(sid, user_id):
            raise ValueError("session revoked")
    except SessionUnavailable as error:
        raise HTTPException(status_code=503, detail="Session service unavailable") from error
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# 获取当前用户
def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(optional_oauth2),
) -> User:
    if token:
        return _decode_user(db, token)
    cookie_token = request.cookies.get(settings.ACCESS_COOKIE_NAME)
    if not cookie_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return _decode_user(db, cookie_token, require_session=True)


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(optional_oauth2),
) -> Optional[User]:
    if token:
        return _decode_user(db, token)
    cookie_token = request.cookies.get(settings.ACCESS_COOKIE_NAME)
    if cookie_token:
        return _decode_user(db, cookie_token, require_session=True)
    return None

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
