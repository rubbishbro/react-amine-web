from typing import Optional
from sqlmodel import Field, Relationship, SQLModel
from datetime import datetime
from enum import Enum # 引入Enum

class InteractionType(str, Enum):
    '''
    互动模型类型
    '''
    LIKE = "like"
    COMMENT = "comment"
    FAVORITE = "favorite"

class Interaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    type: InteractionType # 固定类型
    content: Optional[str] = None # 评论内容
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # 评论同时锚定user和post
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional["User"] = Relationship(back_populates="interactions")

    post_id: Optional[int] = Field(default=None, foreign_key="post.id")
    post: Optional["Post"] = Relationship(back_populates="interactions")

from .user import User
from .post import Post
