from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel
from datetime import datetime
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY # 引入ARRAY

class PostBase(SQLModel):
    '''
    帖子结构，包括标题、内容、摘要（可选）、分类（可选）和标签
    '''
    title: str
    content: str
    summary: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list, sa_column=sa.Column(ARRAY(sa.String)))

class Post(PostBase, table=True): # 帖子表
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow) # 自动调用时间
    updated_at: datetime = Field(default_factory=datetime.utcnow) # 自动调用时间
    is_published: bool = Field(default=False)
    views: int = Field(default=0) # 浏览次数
    is_pinned: bool = Field(default=False) # 全站置顶
    pinned_at: Optional[datetime] = Field(default=None, nullable=True) # 置顶时间
    
    author_id: Optional[int] = Field(default=None, foreign_key="user.id") # 外联
    author: Optional["User"] = Relationship(back_populates="posts") # 反向关联
    
    interactions: List["Interaction"] = Relationship(back_populates="post", sa_relationship_kwargs={"cascade": "all, delete-orphan"}) # 级联

from .user import User
from .interact import Interaction
