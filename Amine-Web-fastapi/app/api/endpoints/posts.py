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
    Retrieve posts.
    """
    posts = crud_post.get_multi(db, skip=skip, limit=limit)
    return posts

@router.post("/", response_model=Post)
def create_post(
    *,
    db: Session = Depends(deps.get_db),
    post_in: PostCreate,
    current_user: User = Depends(deps.check_not_muted),
) -> Any:
    """
    Create new post.
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
    Get post by ID.
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
    Delete a post.
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
    Update a post.
    """
    post = crud_post.get(db, id=id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not current_user.is_superuser and (post.author_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    post = crud_post.update(db, db_obj=post, obj_in=post_in)
    return post
