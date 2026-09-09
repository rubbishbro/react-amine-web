"""
系统公告模型（站内广播，与通知在同一列表展示）。
"""
from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel


class Announcement(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=120)
    content: str = Field(max_length=5000)
    author_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
