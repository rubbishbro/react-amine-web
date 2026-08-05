from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# 公共基类
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False
    userSchool: Optional[str] = None
    userClass: Optional[str] = None

# 注册输入
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    userClass: Optional[str] = Field(default=None, max_length=100)
    userSchool: Optional[str] = Field(default=None, max_length=200)
    
# 更新输入
class UserUpdate(UserBase):
    password: Optional[str] = None

# 数据库返回基类
class UserInDBBase(UserBase):
    id: Optional[int] = None

    class Config:
        from_attributes = True

class User(UserInDBBase):
    # 管理字段（前端展示和管理面板需要）
    title: Optional[str] = None
    is_muted: bool = False
    is_banned: bool = False
    mute_count: int = 0
    ban_count: int = 0
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserPublic(BaseModel):
    """Public profile fields. Email and moderation history stay private."""

    id: int
    username: str
    is_superuser: bool = False
    userSchool: Optional[str] = None
    userClass: Optional[str] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class UserInDB(UserInDBBase):
    hashed_password: str

# 管理员操作请求模型
class SetTitleRequest(BaseModel):
    title: str = Field(min_length=1, max_length=50)

class SetRoleRequest(BaseModel):
    is_superuser: bool

class MuteUserRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)

class BanUserRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
