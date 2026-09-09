from typing import Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlmodel import Session, select
from sqlalchemy import update

from app.crud import crud_post
from app.api import deps
from app.models.user import User
from app.models.user_relation import RelationType, UserRelation
from app.models.notification import Notification, NotificationType
from app.models.post import Post as PostModel
from app.schemas.post import Post, PostCreate, PostUpdate, PostPage

router = APIRouter()

@router.get("/", response_model=PostPage)
def read_posts(
    db: Session = Depends(deps.get_db),
    skip: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None, max_length=40),
) -> Any:
    """
    读取已发布的帖子列表
    """
    posts = crud_post.get_multi(db, skip=skip, limit=limit, category=category)
    items = crud_post.posts_to_public(db, posts)
    total = crud_post.count(db, category=category)
    return {"items": items, "total": total, "skip": skip, "limit": limit}

def _notify_followers_of_post(db: Session, post) -> None:
    """作者发布新帖后，通知其关注者（type=SYSTEM，带 post_id 便于跳转）。"""
    if not post or not post.is_published or not post.author_id:
        return
    follower_ids = db.exec(
        select(UserRelation.from_user_id).where(
            UserRelation.to_user_id == post.author_id,
            UserRelation.relation_type == RelationType.FOLLOW,
        )
    ).all()
    if not follower_ids:
        return
    target_ids = db.exec(
        select(User.id).where(
            User.id.in_(follower_ids),
            User.is_active == True,
            User.is_banned == False,
        )
    ).all()
    if not target_ids:
        return
    author = db.get(User, post.author_id)
    author_name = author.username if author else "用户"
    for tid in target_ids:
        db.add(Notification(
            recipient_id=tid,
            sender_id=post.author_id,
            type=NotificationType.SYSTEM,
            post_id=post.id,
            content=f"{author_name} 发布了新帖《{post.title}》",
        ))
    db.commit()


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
    _notify_followers_of_post(db, post)
    # fan-out commit 会使 post 属性过期，重新加载后再序列化
    post = crud_post.get(db, id=post.id)
    return crud_post.post_to_public(db, post)

@router.get("/{id}", response_model=Post)
def read_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int = Path(gt=0),
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
    # 已发布帖每次打开详情 +1 浏览（原子自增避免并发丢失）
    if post.is_published:
        db.execute(
            update(PostModel).where(PostModel.id == post.id).values(views=PostModel.views + 1)
        )
        db.commit()
        post.views = (post.views or 0) + 1
    return crud_post.post_to_public(db, post)

@router.delete("/{id}", response_model=Post)
def delete_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int = Path(gt=0),
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
    snapshot = crud_post.post_to_public(db, post)
    crud_post.remove(db, id=id)
    return snapshot

@router.put("/{id}", response_model=Post)
def update_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int = Path(gt=0),
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
    return crud_post.post_to_public(db, post)


def _set_pin(db: Session, id: int, current_user: User, pinned: bool):
    """置顶/取消置顶（仅管理员）。"""
    post = crud_post.get(db, id=id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="没有管理员权限")
    if pinned and not post.is_pinned:
        post.is_pinned = True
        post.pinned_at = datetime.utcnow()
    elif not pinned and post.is_pinned:
        post.is_pinned = False
        post.pinned_at = None
    db.add(post)
    db.commit()
    db.refresh(post)
    return crud_post.post_to_public(db, post)


@router.post("/{id}/pin", response_model=Post)
def pin_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int = Path(gt=0),
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """置顶帖子（仅管理员）。"""
    return _set_pin(db, id, current_user, True)


@router.delete("/{id}/pin", response_model=Post)
def unpin_post(
    *,
    db: Session = Depends(deps.get_db),
    id: int = Path(gt=0),
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """取消置顶（仅管理员）。"""
    return _set_pin(db, id, current_user, False)
