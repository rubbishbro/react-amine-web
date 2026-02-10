"""
搜索 API 端点
支持帖子和用户的关键词搜索、Tag搜索
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, or_, col, func

from app.api import deps
from app.models.post import Post
from app.models.user import User
from app.schemas.post import Post as PostSchema
from app.schemas.user import User as UserSchema

router = APIRouter()

@router.get("/posts", response_model=List[PostSchema])
def search_posts(
    *,
    db: Session = Depends(deps.get_db),
    q: str = Query(..., description="搜索关键词，以#开头表示Tag搜索"),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    搜索帖子
    - 普通搜索：关键词匹配标题或内容
    - Tag搜索：以#开头，匹配tags数组中的标签
    """
    query_text = q.strip()
    
    if not query_text:
        return []
    
    # Tag搜索：以#开头
    if query_text.startswith('#'):
        tag = query_text[1:].strip()
        if not tag:
            return []
        
        # PostgreSQL ARRAY类型的搜索：ANY(tags) = tag
        statement = (
            select(Post)
            .where(Post.is_published == True)
            .where(Post.tags.any(tag))  # 任一标签匹配
            .order_by(Post.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    else:
        # 普通关键词搜索：搜索标题和内容
        search_pattern = f"%{query_text}%"
        statement = (
            select(Post)
            .where(Post.is_published == True)
            .where(
                or_(
                    Post.title.ilike(search_pattern),
                    Post.content.ilike(search_pattern),
                )
            )
            .order_by(Post.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    
    posts = db.exec(statement).all()
    return posts

@router.get("/users", response_model=List[UserSchema])
def search_users(
    *,
    db: Session = Depends(deps.get_db),
    q: str = Query(..., description="搜索关键词，匹配用户名"),
    skip: int = 0,
    limit: int = 20,
) -> Any:
    """
    搜索用户
    - 关键词匹配用户名
    """
    query_text = q.strip()
    
    if not query_text:
        return []
    
    # 忽略Tag搜索前缀（用户搜索不需要Tag）
    if query_text.startswith('#'):
        query_text = query_text[1:].strip()
    
    if not query_text:
        return []
    
    search_pattern = f"%{query_text}%"
    statement = (
        select(User)
        .where(User.username.ilike(search_pattern))
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    users = db.exec(statement).all()
    return users

@router.get("/all")
def search_all(
    *,
    db: Session = Depends(deps.get_db),
    q: str = Query(..., description="搜索关键词"),
    post_limit: int = 30,
    user_limit: int = 10,
) -> Any:
    """
    综合搜索：同时搜索帖子和用户
    """
    query_text = q.strip()
    
    if not query_text:
        return {"posts": [], "users": [], "query": query_text}
    
    # 搜索帖子
    if query_text.startswith('#'):
        tag = query_text[1:].strip()
        if tag:
            post_statement = (
                select(Post)
                .where(Post.is_published == True)
                .where(Post.tags.any(tag))
                .order_by(Post.created_at.desc())
                .limit(post_limit)
            )
        else:
            post_statement = select(Post).where(Post.id == -1)  # 空结果
    else:
        search_pattern = f"%{query_text}%"
        post_statement = (
            select(Post)
            .where(Post.is_published == True)
            .where(
                or_(
                    Post.title.ilike(search_pattern),
                    Post.content.ilike(search_pattern),
                )
            )
            .order_by(Post.created_at.desc())
            .limit(post_limit)
        )
    
    posts = db.exec(post_statement).all()
    
    # 搜索用户（Tag搜索也搜用户）
    user_query = query_text[1:].strip() if query_text.startswith('#') else query_text
    if user_query:
        user_pattern = f"%{user_query}%"
        user_statement = (
            select(User)
            .where(User.username.ilike(user_pattern))
            .order_by(User.created_at.desc())
            .limit(user_limit)
        )
        users = db.exec(user_statement).all()
    else:
        users = []
    
    return {
        "posts": posts,
        "users": users,
        "query": query_text,
        "is_tag_search": query_text.startswith('#'),
    }
