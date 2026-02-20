"""
通知模型
通知类型: reply（回复）、like（点赞）、follow（关注）、system（系统）
"""
from typing import Optional
from enum import Enum
from datetime import datetime
from sqlmodel import Field, SQLModel


class NotificationType(str, Enum):
    REPLY = "reply"
    LIKE = "like"
    FOLLOW = "follow"
    SYSTEM = "system"


class Notification(SQLModel, table=True):
    """
    通知表
    - recipient_id: 接收通知的用户 ID
    - sender_id:    产生通知的用户 ID（系统通知为 None）
    - type:         通知类型
    - post_id:      关联的帖子 ID（可 None）
    - comment_id:   关联的评论 ID（可 None）
    - content:      通知文案摘要（可选，方便前端直接展示）
    - is_read:      是否已读
    - created_at:   创建时间
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    recipient_id: int = Field(index=True, foreign_key="user.id")
    sender_id: Optional[int] = Field(default=None, foreign_key="user.id")
    type: NotificationType = Field(index=True)
    post_id: Optional[int] = Field(default=None)
    comment_id: Optional[int] = Field(default=None)
    content: Optional[str] = Field(default=None, max_length=300)
    is_read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
