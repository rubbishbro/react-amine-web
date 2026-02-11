from typing import List, Optional
from sqlmodel import Session, select
from app.models.interact import Interaction, InteractionType
from app.schemas.interact import InteractionCreate

# 创建互动
def create(db: Session, *, obj_in: InteractionCreate, user_id: int) -> Optional[Interaction]:
    # 如果是点赞，检查是否已存在相同的点赞，防止重复点赞
    if obj_in.type == InteractionType.LIKE:
        statement = select(Interaction).where(
            Interaction.user_id == user_id,
            Interaction.post_id == obj_in.post_id,
            Interaction.type == InteractionType.LIKE
        )
        existing_like = db.exec(statement).first()
        if existing_like:
            # 如果已经点赞了，把它删掉
            db.delete(existing_like)
            db.commit()
            return None # 或者返回一个特殊标记告诉前端已取消

    db_obj = Interaction(
        type=obj_in.type,
        content=obj_in.content,
        post_id=obj_in.post_id,
        user_id=user_id
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
