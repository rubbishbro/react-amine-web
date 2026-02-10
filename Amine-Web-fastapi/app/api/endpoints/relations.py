"""
用户关系 API 端点
"""
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.api import deps
from app.crud import crud_relation
from app.models.user import User
from app.models.user_relation import RelationType
from app.schemas.user_relation import UserRelation, RelationStatus
from app.schemas.user import User as UserSchema

router = APIRouter()

@router.post("/{user_id}/follow", response_model=UserRelation)
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
    
    # 添加关注关系
    relation = crud_relation.add_relation(
        db, 
        from_user_id=current_user.id,
        to_user_id=user_id,
        relation_type=RelationType.FOLLOW
    )
    return relation

@router.delete("/{user_id}/follow")
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
    
    return {"message": "已取消关注"}

@router.post("/{user_id}/block", response_model=UserRelation)
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
    return relation

@router.delete("/{user_id}/block")
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
    
    return {"message": "已取消拉黑"}

@router.get("/{user_id}/followers", response_model=List[UserSchema])
def get_followers(
    user_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    获取用户的粉丝列表
    """
    followers = crud_relation.get_followers(db, user_id=user_id, skip=skip, limit=limit)
    return followers

@router.get("/{user_id}/following", response_model=List[UserSchema])
def get_following(
    user_id: int,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    获取用户关注的人列表
    """
    following = crud_relation.get_following(db, user_id=user_id, skip=skip, limit=limit)
    return following

@router.get("/me/blocked", response_model=List[UserSchema])
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
