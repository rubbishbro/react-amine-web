from typing import List, Optional # 导入所需类型
from sqlmodel import Field, Relationship, SQLModel # 导入SQLModel相关模块
from datetime import datetime # 处理日期时间

class UserBase(SQLModel): 
    email: str = Field(unique=True, index=True) # 用户邮箱，唯一且索引
    username: str = Field(unique=True, index=True) # 用户昵称，唯一且索引
    is_active: bool = True # 用户是否激活
    is_superuser: bool = False # 是否管理员

class User(UserBase, table=True): # 继承UserBase，并指定表名
    '''
    id, hashed_password, posts, interactions定义
    '''
    id: Optional[int] = Field(default=None, primary_key=True) 
    hashed_password: str
    
    posts: List["Post"] = Relationship(back_populates="author", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    # 用户与帖子的一对多关系，级联删除
    interactions: List["Interaction"] = Relationship(back_populates="user", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

# 解决循环导入问题
from .post import Post
from .interact import Interaction
