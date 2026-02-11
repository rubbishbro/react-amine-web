from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import crud
from app.crud import crud_post
from app.api import deps
from app.models.user import User
from app.schemas.post import Post, PostCreate, PostUpdate

router = APIRouter()

@router.get("/", response_model=List[Post])
def read_posts(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 1000,
) -> Any:
    """
    读取已发布的帖子列表
    目前前端使用假分页，实际上是一次性获取大量数据，故limit设置较大，后续需要更改前端
    """
    posts = crud_post.get_multi(db, skip=skip, limit=limit)
    return posts

@router.post("/", response_model=Post)
def create_post(
    *,
    db: Session = Depends(deps.get_db),
    post_in: PostCreate,
    current_user: User = Depends(deps.get_current_active_user),
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
) -> Any:
    """
    读取指定ID的帖子
    """
    post = crud_post.get(db, id=id)
    if not post:
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
