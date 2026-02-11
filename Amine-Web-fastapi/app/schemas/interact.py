from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from app.models.interact import InteractionType

# 互动输入/输出公共基类
class InteractionBase(BaseModel):
    type: InteractionType
    content: Optional[str] = None

# 此处无需user_id，post_id由路径参数（token）传入
class InteractionCreate(InteractionBase):
    post_id: int

# 数据库返回基类
class InteractionInDBBase(InteractionBase):
    id: int
    user_id: int
    post_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Interaction(InteractionInDBBase):
    pass
