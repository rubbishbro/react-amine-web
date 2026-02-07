# 用户身份校验与令牌生成
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# 采用bcrypt算哈希处理
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 校验密码
def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt 限制密码最长 72 字节，验证时也需要截断
    return pwd_context.verify(plain_password[:72], hashed_password)

# 生成密码哈希
def get_password_hash(password: str) -> str:
    # bcrypt 限制密码最长 72 字节，超出部分自动截断
    return pwd_context.hash(password[:72])

# 生成登录凭证（JWT TOKEN）
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    # 返回token，（目前token时间30min）
    return encoded_jwt
