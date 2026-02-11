from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

# Shared properties
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_active: Optional[bool] = True

# Properties to receive via API on creation
class UserCreate(UserBase):
    email: EmailStr
    username: str
    password: str

# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None

class UserInDBBase(UserBase):
    id: Optional[int] = None
    is_superuser: bool = False
    title: Optional[str] = None
    is_muted: bool = False
    is_banned: bool = False
    mute_count: int = 0
    ban_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Additional properties to return via API
class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str

# Admin operations schemas
class SetTitleRequest(BaseModel):
    title: str

class SetRoleRequest(BaseModel):
    is_superuser: bool

class MuteUserRequest(BaseModel):
    reason: Optional[str] = None

class BanUserRequest(BaseModel):
    reason: str
