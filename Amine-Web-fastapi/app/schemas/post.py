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
    tags: List[str] = Field(default_factory=list)

# Properties to receive on creation
class PostCreate(PostBase):
    pass

# Properties to receive on update
class PostUpdate(PostBase):
    pass

# Properties shared by models stored in DB
class PostInDBBase(PostBase):
    id: int
    author_id: int
    created_at: datetime
    updated_at: datetime
    is_published: bool = False

    class Config:
        from_attributes = True

# Properties to return to client
class Post(PostInDBBase):
    author: Optional[User] = None  # 包含完整作者信息
