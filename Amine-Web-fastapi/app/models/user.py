from typing import List, Optional # 导入所需类型
from sqlmodel import Field, Relationship, SQLModel # 导入SQLModel相关模块
from datetime import datetime # 处理日期时间

class UserBase(SQLModel): 
    email: str = Field(unique=True, index=True) # 用户邮箱，唯一且索引
    username: str = Field(unique=True, index=True) # 用户昵称，唯一且索引
    userSchool: Optional[str] = None # 用户学校（可选）
    userClass: Optional[str] = None # 用户班级（可选）
    is_active: bool = True # 用户是否激活
    is_superuser: bool = False # 是否管理员

class User(UserBase, table=True): # 继承UserBase，并指定表名
    '''
    用户模型：包含基础信息和管理字段
    '''
    id: Optional[int] = Field(default=None, primary_key=True) 
    hashed_password: str
    
    # 管理字段
    title: Optional[str] = None  # 用户头衔
    is_muted: bool = False  # 是否被禁言
    is_banned: bool = False  # 是否被封禁
    mute_count: int = 0  # 被禁言次数
    ban_count: int = 0  # 被封禁次数
    avatar_url: Optional[str] = None  # 头像 URL（七牛 CDN 或本地路径）
    cover_url: Optional[str] = None   # 头图 URL
    created_at: datetime = Field(default_factory=datetime.utcnow)  # 创建时间
    updated_at: datetime = Field(default_factory=datetime.utcnow)  # 更新时间
    
    posts: List["Post"] = Relationship(back_populates="author", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    # 用户与帖子的一对多关系，级联删除
    interactions: List["Interaction"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

# 解决循环导入问题
from .post import Post
from .interact import Interaction
