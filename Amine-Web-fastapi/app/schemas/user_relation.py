"""
用户关系 Pydantic Schema
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.user_relation import RelationType

# 基础 Schema
class UserRelationBase(BaseModel):
    relation_type: RelationType

# 创建关系时使用
class UserRelationCreate(UserRelationBase):
    to_user_id: int

# 返回给前端的 Schema
class UserRelation(UserRelationBase):
    id: int
    from_user_id: int
    to_user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# 关系状态查询结果
class RelationStatus(BaseModel):
    is_following: bool = False
    is_blocked: bool = False
    is_muted: bool = False
    is_followed_by: bool = False  # 对方是否关注了你
