"""
评论 Pydantic Schema
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# 基础 Schema
class CommentBase(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    parent_id: Optional[int] = None

# 创建评论时使用
class CommentCreate(CommentBase):
    post_id: int

# 更新评论时使用
class CommentUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

# 返回给前端的 Schema
class Comment(CommentBase):
    id: int
    post_id: int
    author_id: int
    likes: int
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    
    class Config:
        from_attributes = True

# 包含作者信息的评论（用于列表展示）
class CommentWithAuthor(Comment):
    author_name: str
    author_avatar: Optional[str] = None
