from typing import List, Optional, Tuple
from sqlmodel import Session, select
from app.models.interact import Interaction, InteractionType
from app.schemas.interact import InteractionCreate

# 通用切换函数
def _toggle(db: Session, *, post_id: int, user_id: int, itype: InteractionType) -> Tuple[bool, Optional[Interaction]]:
    """
    切换某种交互类型（已存在则删除，不存在则创建）
    返回 (activated: bool, interaction_or_None)
    """
    statement = select(Interaction).where(
        Interaction.user_id == user_id,
        Interaction.post_id == post_id,
        Interaction.type == itype,
    )
    existing = db.exec(statement).first()
    if existing:
        db.delete(existing)
        db.commit()
        return False, None
    obj = Interaction(type=itype, post_id=post_id, user_id=user_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return True, obj

# 点赞切换
def toggle_like(db: Session, *, post_id: int, user_id: int) -> bool:
    """切换帖子点赞，返回操作后是否为点赞状态"""
    liked, _ = _toggle(db, post_id=post_id, user_id=user_id, itype=InteractionType.LIKE)
    return liked

# 收藏切换
def toggle_favorite(db: Session, *, post_id: int, user_id: int) -> bool:
    """切换帖子收藏，返回操作后是否为收藏状态"""
    favorited, _ = _toggle(db, post_id=post_id, user_id=user_id, itype=InteractionType.FAVORITE)
    return favorited

# 批量查询当前用户对所有帖子的点赞/收藏 ID 列表
def get_user_liked_ids(db: Session, *, user_id: int) -> List[int]:
    statement = select(Interaction.post_id).where(
        Interaction.user_id == user_id,
        Interaction.type == InteractionType.LIKE,
    )
    return list(db.exec(statement).all())

def get_user_favorited_ids(db: Session, *, user_id: int) -> List[int]:
    statement = select(Interaction.post_id).where(
        Interaction.user_id == user_id,
        Interaction.type == InteractionType.FAVORITE,
    )
    return list(db.exec(statement).all())

# 创建互动（保留兼容旧接口）
def create(db: Session, *, obj_in: InteractionCreate, user_id: int) -> Optional[Interaction]:
    if obj_in.type in (InteractionType.LIKE, InteractionType.FAVORITE):
        _, obj = _toggle(db, post_id=obj_in.post_id, user_id=user_id, itype=obj_in.type)
        return obj
    db_obj = Interaction(
        type=obj_in.type,
        content=obj_in.content,
        post_id=obj_in.post_id,
        user_id=user_id,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

# 获取帖子互动
def get_by_post(db: Session, *, post_id: int, skip: int = 0, limit: int = 100) -> List[Interaction]:
    statement = select(Interaction).where(Interaction.post_id == post_id).offset(skip).limit(limit)
    return db.exec(statement).all()

# 获取用户互动
def get_by_user(db: Session, *, user_id: int, skip: int = 0, limit: int = 100) -> List[Interaction]:
    statement = select(Interaction).where(Interaction.user_id == user_id).offset(skip).limit(limit)
    return db.exec(statement).all()
