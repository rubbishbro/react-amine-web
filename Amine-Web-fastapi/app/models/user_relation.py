"""
用户关系模型 - 关注/拉黑/屏蔽
"""
from typing import Optional
from sqlmodel import Field, SQLModel, UniqueConstraint
from datetime import datetime
from enum import Enum

class RelationType(str, Enum):
    """关系类型枚举"""
    FOLLOW = "follow"      # 关注
    BLOCK = "block"        # 拉黑
    MUTE = "mute"          # 屏蔽/静音

class UserRelation(SQLModel, table=True):
    """
    用户关系表
    记录用户之间的关注、拉黑、屏蔽等关系
    """
    __tablename__ = "user_relation"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    from_user_id: int = Field(foreign_key="user.id", index=True)  # 发起者
    to_user_id: int = Field(foreign_key="user.id", index=True)    # 目标用户
    relation_type: RelationType = Field(index=True)                # 关系类型
    created_at: datetime = Field(default_factory=datetime.utcnow)  # 创建时间
    
    class Config:
        # SQLAlchemy 表参数
        table_args = (
            # 联合唯一约束：一个用户对另一个用户的某种关系只能有一条记录
            UniqueConstraint('from_user_id', 'to_user_id', 'relation_type', 
                           name='unique_user_relation'),
        )
