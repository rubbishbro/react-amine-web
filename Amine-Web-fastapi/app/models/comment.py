# 评论模型
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, Relationship, SQLModel
from datetime import datetime

if TYPE_CHECKING:
    from app.models.user import User

class Comment(SQLModel, table=True):
    """
    评论表
    支持对帖子的评论和评论的嵌套回复
    """
    __tablename__ = "comment"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # 评论内容
    content: str = Field(max_length=2000)  # 评论内容，最多2000字
    
    # 关联关系
    post_id: int = Field(foreign_key="post.id", index=True)      # 所属帖子
    author_id: int = Field(foreign_key="user.id", index=True)    # 评论作者
    parent_id: Optional[int] = Field(default=None, foreign_key="comment.id", index=True)  # 父评论ID（用于嵌套回复）

    # Author Relationship
    author: Optional["User"] = Relationship()

    # 统计数据
    likes: int = Field(default=0)  # 点赞数
    
    # 时间戳
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # 软删除标记
    is_deleted: bool = Field(default=False)
    
    # 关系映射（可选，用于 ORM 查询）
    # replies: List["Comment"] = Relationship(
    #     back_populates="parent",
    #     sa_relationship_kwargs={
    #         "remote_side": "Comment.id",
    #         "cascade": "all, delete-orphan"
    #     }
    # )
