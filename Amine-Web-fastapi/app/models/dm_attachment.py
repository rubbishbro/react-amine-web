from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class DMAttachment(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    storage_key: str = Field(index=True, unique=True, max_length=128)
    owner_id: int = Field(index=True, foreign_key="user.id")
    receiver_id: Optional[int] = Field(default=None, index=True, foreign_key="user.id")
    mime_type: str = Field(max_length=100)
    size: int
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
