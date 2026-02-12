from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from app.schemas.user import User

# 帖子输入/输出公共基类
class PostBase(BaseModel):
    title: str
    content: str
    summary: Optional[str] = None
    category: Optional[str] = None
    # 去除可变默认值陷阱
    tags: List[str] = Field(default_factory=list)

# 帖子创建输入
class PostCreate(PostBase):
    pass

# 帖子更新输入
class PostUpdate(PostBase):
    pass

# 数据库中存储的模型共享属性
class PostInDBBase(PostBase):
    id: int
    author_id: int
    created_at: datetime
    updated_at: datetime
    is_published: bool = False

    class Config:
        from_attributes = True

# 返回给客户端的属性
class Post(PostInDBBase):
    author: Optional[User] = None  # 包含完整作者信息
