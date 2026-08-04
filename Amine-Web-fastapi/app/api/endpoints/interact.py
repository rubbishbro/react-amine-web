from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.crud import crud_interact, crud_notification
from app.api import deps
from app.models.notification import NotificationType
from app.models.post import Post
from app.models.user import User
from app.schemas.interact import Interaction, InteractionCreate

router = APIRouter()

# ─── 切换点赞 ───────────────────────────────────────────────────────────────
@router.post("/posts/{post_id}/like")
def toggle_like(
    post_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    切换帖子点赞状态（已点赞则取消，未点赞则添加）
    """
    post = db.get(Post, post_id)
    if not post or not post.is_published:
        raise HTTPException(status_code=404, detail="Post not found")
    liked = crud_interact.toggle_like(db, post_id=post_id, user_id=current_user.id)
    if liked and post.author_id and post.author_id != current_user.id:
        crud_notification.create(
            db,
            recipient_id=post.author_id,
            sender_id=current_user.id,
            type=NotificationType.LIKE,
            post_id=post.id,
            content=(post.summary or post.title)[:300],
        )
    return {"liked": liked, "post_id": post_id}

# ─── 切换收藏 ───────────────────────────────────────────────────────────────
@router.post("/posts/{post_id}/favorite")
def toggle_favorite(
    post_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    切换帖子收藏状态（已收藏则取消，未收藏则添加）
    """
    post = db.get(Post, post_id)
    if not post or not post.is_published:
        raise HTTPException(status_code=404, detail="Post not found")
    favorited = crud_interact.toggle_favorite(db, post_id=post_id, user_id=current_user.id)
    return {"favorited": favorited, "post_id": post_id}

# ─── 查询当前用户对某帖子的交互状态 ─────────────────────────────────────────
@router.get("/posts/{post_id}/me")
def get_my_post_status(
    post_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    查询当前用户是否已点赞/收藏某帖子
    """
    liked_ids = crud_interact.get_user_liked_ids(db, user_id=current_user.id)
    favorited_ids = crud_interact.get_user_favorited_ids(db, user_id=current_user.id)
    return {
        "liked": post_id in liked_ids,
        "favorited": post_id in favorited_ids,
    }

# ─── 批量查询当前用户所有已点赞/收藏的帖子 ID ───────────────────────────────
@router.get("/me/status")
def get_my_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    返回当前用户所有已点赞和已收藏的帖子 ID 列表（用于前端登录后批量初始化）
    """
    liked_ids = crud_interact.get_user_liked_ids(db, user_id=current_user.id)
    favorited_ids = crud_interact.get_user_favorited_ids(db, user_id=current_user.id)
    return {
        "liked_ids": liked_ids,
        "favorited_ids": favorited_ids,
    }

# ─── 以下保留旧接口兼容 ───────────────────────────────────────────────────────
@router.post("/", response_model=Interaction, deprecated=True)
def create_interaction(
    *,
    db: Session = Depends(deps.get_db),
    interaction_in: InteractionCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    [已弃用] 通用互动接口，请使用 /posts/{post_id}/like 或 /posts/{post_id}/favorite
    """
    interaction = crud_interact.create(db, obj_in=interaction_in, user_id=current_user.id)
    return interaction

@router.get("/user/me", response_model=List[Interaction])
def read_my_interactions(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    获取当前用户的交互记录
    """
    interactions = crud_interact.get_by_user(db, user_id=current_user.id, skip=skip, limit=limit)
    return interactions

@router.get("/post/{post_id}", response_model=List[Interaction])
def read_post_interactions(
    post_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    获取指定帖子的交互记录
    """
    interactions = crud_interact.get_by_post(db, post_id=post_id, skip=skip, limit=limit)
    return interactions
