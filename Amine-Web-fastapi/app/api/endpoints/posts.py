from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import crud
from app.crud import crud_post
from app.api import deps
from app.models.user import User
from app.schemas.post import Post, PostCreate, PostUpdate, PostPage

router = APIRouter()

@router.get("/", response_model=PostPage)
def read_posts(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
) -> Any:
    """
    读取已发布的帖子列表
    """
    skip = max(skip, 0)
    limit = min(max(limit, 1), 100)
    posts = crud_post.get_multi(db, skip=skip, limit=limit, category=category)
    total = crud_post.count(db, category=category)
    return {"items": posts, "total": total, "skip": skip, "limit": limit}

@router.post("/", response_model=Post)
def create_post(
    *,
    db: Session = Depends(deps.get_db),
    post_in: PostCreate,
    current_user: User = Depends(deps.check_not_muted),
) -> Any:
    """
    创建新帖子
    """
    post = crud_post.create(db, obj_in=post_in, author_id=current_user.id)
    return post

@router.get("/{id}", response_model=Post)
def read_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: Optional[User] = Depends(deps.get_optional_current_user),
) -> Any:
    """
    读取指定ID的帖子
    """
    post = crud_post.get(db, id=id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.is_published and (
        current_user is None
        or (not current_user.is_superuser and post.author_id != current_user.id)
    ):
        raise HTTPException(status_code=404, detail="Post not found")
    return post

@router.delete("/{id}", response_model=Post)
def delete_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    删除指定ID的帖子
    只有超级用户或帖子作者本人可以删除帖子
    """
    post = crud_post.get(db, id=id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not current_user.is_superuser and (post.author_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    post = crud_post.remove(db, id=id)
    return post

@router.put("/{id}", response_model=Post)
def update_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    post_in: PostUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    更新指定ID的帖子
    只有超级用户或帖子作者本人可以更新帖子
    """
    post = crud_post.get(db, id=id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not current_user.is_superuser and (post.author_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    post = crud_post.update(db, db_obj=post, obj_in=post_in)
    return post
