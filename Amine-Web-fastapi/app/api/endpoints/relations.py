"""
用户关系 API 端点
"""
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api import deps
from app.crud import crud_relation, crud_notification
from app.models.notification import NotificationType
from app.models.user import User
from app.models.user_relation import RelationType
from app.schemas.user_relation import RelationActionResponse, RelationStatus
from app.schemas.user import UserPublic

router = APIRouter()

@router.post("/{user_id}/follow", response_model=RelationActionResponse)
def follow_user(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    关注用户
    """
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="不能关注自己")
    
    # 检查目标用户是否存在
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 不允许在拉黑关系存在时关注（双向检查）
    if crud_relation.check_relation(db, current_user.id, user_id, RelationType.BLOCK) or \
       crud_relation.check_relation(db, user_id, current_user.id, RelationType.BLOCK):
        raise HTTPException(status_code=403, detail="存在拉黑关系，无法关注")

    # 已关注返回冲突
    if crud_relation.check_relation(db, current_user.id, user_id, RelationType.FOLLOW):
        raise HTTPException(status_code=409, detail="已关注，无需重复操作")

    # 添加关注关系
    relation = crud_relation.add_relation(
        db,
        from_user_id=current_user.id,
        to_user_id=user_id,
        relation_type=RelationType.FOLLOW,
    )
    crud_notification.create(
        db,
        recipient_id=user_id,
        sender_id=current_user.id,
        type=NotificationType.FOLLOW,
        content=f"{current_user.username} followed you",
    )
    return {"success": True, "relation": relation}

@router.delete("/{user_id}/follow", response_model=RelationActionResponse)
def unfollow_user(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    取消关注
    """
    success = crud_relation.remove_relation(
        db,
        from_user_id=current_user.id,
        to_user_id=user_id,
        relation_type=RelationType.FOLLOW
    )
    if not success:
        raise HTTPException(status_code=404, detail="关注关系不存在")
    
    return {"success": True, "relation": None}

@router.post("/{user_id}/block", response_model=RelationActionResponse)
def block_user(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    拉黑用户
    """
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="不能拉黑自己")
    
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 已拉黑返回冲突
    if crud_relation.check_relation(db, current_user.id, user_id, RelationType.BLOCK):
        raise HTTPException(status_code=409, detail="已拉黑，无需重复操作")

    # 拉黑时自动取消关注
    crud_relation.remove_relation(
        db,
        from_user_id=current_user.id,
        to_user_id=user_id,
        relation_type=RelationType.FOLLOW
    )
    
    relation = crud_relation.add_relation(
        db,
        from_user_id=current_user.id,
        to_user_id=user_id,
        relation_type=RelationType.BLOCK
    )
    return {"success": True, "relation": relation}

@router.delete("/{user_id}/block", response_model=RelationActionResponse)
def unblock_user(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    取消拉黑
    """
    success = crud_relation.remove_relation(
        db,
        from_user_id=current_user.id,
        to_user_id=user_id,
        relation_type=RelationType.BLOCK
    )
    if not success:
        raise HTTPException(status_code=404, detail="拉黑关系不存在")
    
    return {"success": True, "relation": None}

@router.get("/{user_id}/followers", response_model=List[UserPublic])
def get_followers(
    user_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    order: str = "desc",
) -> Any:
    """
    获取用户的粉丝列表
    """
    followers = crud_relation.get_followers(db, user_id=user_id, skip=skip, limit=limit, order=order)
    return followers

@router.get("/{user_id}/following", response_model=List[UserPublic])
def get_following(
    user_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    order: str = "desc",
) -> Any:
    """
    获取用户关注的人列表
    """
    following = crud_relation.get_following(db, user_id=user_id, skip=skip, limit=limit, order=order)
    return following

@router.get("/me/blocked", response_model=List[UserPublic])
def get_my_blocked_users(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    获取我拉黑的用户列表
    """
    blocked = crud_relation.get_blocked_users(db, user_id=current_user.id)
    return blocked

@router.get("/{user_id}/relation", response_model=RelationStatus)
def get_relation_status(
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    获取当前用户与指定用户的关系状态
    """
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="不能查询与自己的关系")
    
    is_following = crud_relation.check_relation(
        db, current_user.id, user_id, RelationType.FOLLOW
    )
    is_blocked = crud_relation.check_relation(
        db, current_user.id, user_id, RelationType.BLOCK
    )
    is_muted = crud_relation.check_relation(
        db, current_user.id, user_id, RelationType.MUTE
    )
    is_followed_by = crud_relation.check_relation(
        db, user_id, current_user.id, RelationType.FOLLOW
    )
    
    return RelationStatus(
        is_following=is_following,
        is_blocked=is_blocked,
        is_muted=is_muted,
        is_followed_by=is_followed_by,
    )

@router.get("/{user_id}/stats")
def get_user_stats(
    user_id: int,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    获取用户的关注/粉丝统计
    """
    follower_count = crud_relation.get_follower_count(db, user_id)
    following_count = crud_relation.get_following_count(db, user_id)
    
    return {
        "follower_count": follower_count,
        "following_count": following_count,
    }
