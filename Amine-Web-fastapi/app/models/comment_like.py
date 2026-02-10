"""
评论点赞模型
"""
from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel, UniqueConstraint

class CommentLike(SQLModel, table=True):
    __tablename__ = "comment_like"

    id: Optional[int] = Field(default=None, primary_key=True)
    comment_id: int = Field(foreign_key="comment.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        table_args = (
            UniqueConstraint("comment_id", "user_id", name="unique_comment_like"),
        )
