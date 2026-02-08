from typing import Any, Dict, Optional, Union
from sqlmodel import Session, select
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate

# 根据邮箱获取用户 
def get_by_email(db: Session, *, email: str) -> Optional[User]:
    statement = select(User).where(User.email == email)
    return db.exec(statement).first()

# 根据用户名获取用户
def get_by_username(db: Session, *, username: str) -> Optional[User]:
    statement = select(User).where(User.username == username)
    return db.exec(statement).first()

# 创建用户
def create(db: Session, *, obj_in: UserCreate) -> User:
    db_obj = User(
        email=obj_in.email,
        hashed_password=get_password_hash(obj_in.password),
        username=obj_in.username,
        is_superuser=False, # 防止恶意请求
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

# 认证用户（仅邮箱）
def authenticate(db: Session, *, email: str, password: str) -> Optional[User]:
    user = get_by_email(db, email=email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

# 认证用户（支持邮箱或用户名）
def authenticate_flexible(db: Session, *, identifier: str, password: str) -> Optional[User]:
    """
    支持使用邮箱或用户名登录
    identifier: 可以是邮箱或用户名
    """
    # 先尝试作为邮箱查询
    user = get_by_email(db, email=identifier)
    
    # 如果邮箱未找到，尝试作为用户名查询
    if not user:
        user = get_by_username(db, username=identifier)
    
    # 验证密码
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
