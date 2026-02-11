from typing import Optional
from pydantic import BaseModel, EmailStr

# 公共基类
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False

# 注册输入
class UserCreate(UserBase):
    email: EmailStr
    username: str
    password: str
    
# 更新输入
class UserUpdate(UserBase):
    password: Optional[str] = None

# 数据库返回基类
class UserInDBBase(UserBase):
    id: Optional[int] = None

    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str
