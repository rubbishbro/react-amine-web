"""
用户关系 CRUD 操作
"""
from typing import Optional, List
from sqlmodel import Session, select
from app.models.user_relation import UserRelation, RelationType
from app.models.user import User

def add_relation(
    db: Session, 
    from_user_id: int, 
    to_user_id: int, 
    relation_type: RelationType
) -> UserRelation:
    """
    添加用户关系
    """
    # 检查是否已存在
    statement = select(UserRelation).where(
        UserRelation.from_user_id == from_user_id,
        UserRelation.to_user_id == to_user_id,
        UserRelation.relation_type == relation_type
    )
    existing = db.exec(statement).first()
    
    if existing:
        return existing
    
    # 创建新关系
    relation = UserRelation(
        from_user_id=from_user_id,
        to_user_id=to_user_id,
        relation_type=relation_type
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    return relation

def remove_relation(
    db: Session,
    from_user_id: int,
    to_user_id: int,
    relation_type: RelationType
) -> bool:
    """
    删除用户关系
    """
    statement = select(UserRelation).where(
        UserRelation.from_user_id == from_user_id,
        UserRelation.to_user_id == to_user_id,
        UserRelation.relation_type == relation_type
    )
    relation = db.exec(statement).first()
    
    if relation:
        db.delete(relation)
        db.commit()
        return True
    return False

def check_relation(
    db: Session,
    from_user_id: int,
    to_user_id: int,
    relation_type: RelationType
) -> bool:
    """
    检查两个用户之间是否存在某种关系
    """
    statement = select(UserRelation).where(
        UserRelation.from_user_id == from_user_id,
        UserRelation.to_user_id == to_user_id,
        UserRelation.relation_type == relation_type
    )
    return db.exec(statement).first() is not None

def get_followers(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[User]:
    """
    获取用户的粉丝列表
    """
    statement = (
        select(User)
        .join(UserRelation, UserRelation.from_user_id == User.id)
        .where(
            UserRelation.to_user_id == user_id,
            UserRelation.relation_type == RelationType.FOLLOW
        )
        .offset(skip)
        .limit(limit)
    )
    return list(db.exec(statement).all())

def get_following(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[User]:
    """
    获取用户关注的人列表
    """
    statement = (
        select(User)
        .join(UserRelation, UserRelation.to_user_id == User.id)
        .where(
            UserRelation.from_user_id == user_id,
            UserRelation.relation_type == RelationType.FOLLOW
        )
        .offset(skip)
        .limit(limit)
    )
    return list(db.exec(statement).all())

def get_blocked_users(db: Session, user_id: int) -> List[User]:
    """
    获取用户拉黑的人列表
    """
    statement = (
        select(User)
        .join(UserRelation, UserRelation.to_user_id == User.id)
        .where(
            UserRelation.from_user_id == user_id,
            UserRelation.relation_type == RelationType.BLOCK
        )
    )
    return list(db.exec(statement).all())

def get_follower_count(db: Session, user_id: int) -> int:
    """
    获取粉丝数量
    """
    statement = select(UserRelation).where(
        UserRelation.to_user_id == user_id,
        UserRelation.relation_type == RelationType.FOLLOW
    )
    return len(list(db.exec(statement).all()))

def get_following_count(db: Session, user_id: int) -> int:
    """
    获取关注数量
    """
    statement = select(UserRelation).where(
        UserRelation.from_user_id == user_id,
        UserRelation.relation_type == RelationType.FOLLOW
    )
    return len(list(db.exec(statement).all()))
