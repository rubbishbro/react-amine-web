from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from app.schemas.user import UserPublic

# 帖子输入/输出公共基类
class PostBase(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=50_000)
    summary: Optional[str] = Field(default=None, max_length=500)
    category: Optional[str] = Field(default=None, max_length=40)
    tags: List[str] = Field(default_factory=list, max_length=10)

    model_config = ConfigDict(extra="forbid")

    @field_validator("title", "summary", "category")
    @classmethod
    def reject_control_characters(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and any(ord(char) < 32 and char not in "\t\n\r" for char in value):
            raise ValueError("control characters are not allowed")
        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: List[str]) -> List[str]:
        cleaned = []
        for tag in tags:
            tag = tag.strip()
            if not tag or len(tag) > 30:
                raise ValueError("each tag must contain 1 to 30 characters")
            if any(ord(char) < 32 for char in tag):
                raise ValueError("control characters are not allowed in tags")
            cleaned.append(tag)
        return cleaned

# 帖子创建输入
class PostCreate(PostBase):
    is_published: bool = True

# 帖子更新输入
class PostUpdate(PostBase):
    is_published: Optional[bool] = None

# 数据库中存储的模型共享属性
#
# 输入模型保持严格校验；输出模型需要兼容加固前已经存在的数据。否则历史记录里
# 的空正文会在序列化阶段触发 ResponseValidationError，让整个帖子列表返回 500。
class PostInDBBase(BaseModel):
    title: str
    content: str
    summary: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    id: int
    author_id: int
    created_at: datetime
    updated_at: datetime
    is_published: bool = False

    model_config = ConfigDict(from_attributes=True)

# 返回给客户端的属性
class Post(PostInDBBase):
    author: Optional[UserPublic] = None


class PostPage(BaseModel):
    items: List[Post]
    total: int
    skip: int
    limit: int
