"""
私信（Direct Message）模型
"""
from typing import Optional
from datetime import datetime
from uuid import UUID
from sqlmodel import Field, SQLModel


class DirectMessage(SQLModel, table=True):
    """
    私信表
    - sender_id:   发送方用户 ID
    - receiver_id: 接收方用户 ID
    - content:     消息内容
    - is_read:     接收方是否已读
    - recalled:    发送方是否已撤回
    - created_at:  发送时间
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    sender_id: int = Field(index=True, foreign_key="user.id")
    receiver_id: int = Field(index=True, foreign_key="user.id")
    content: str = Field(max_length=2000)
    attachment_id: Optional[UUID] = Field(
        default=None, foreign_key="dmattachment.id", index=True, unique=True
    )
    is_read: bool = Field(default=False)
    recalled: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
