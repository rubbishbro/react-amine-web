"""
评论 CRUD 操作
"""
from typing import Optional, List
from sqlmodel import Session, select, func
from sqlalchemy.orm import joinedload
from app.models.comment import Comment
from app.models.comment_like import CommentLike
from app.schemas.comment import CommentCreate, CommentUpdate

def create(db: Session, *, obj_in: CommentCreate, author_id: int) -> Comment:
    """
    创建评论
    """
    comment = Comment(
        content=obj_in.content,
        post_id=obj_in.post_id,
        author_id=author_id,
        parent_id=obj_in.parent_id
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

def get(db: Session, comment_id: int) -> Optional[Comment]:
    """
    根据ID获取评论
    """
    return db.get(Comment, comment_id)

def get_by_post(
    db: Session,
    post_id: int,
    skip: int = 0,
    limit: int = 100,
    include_deleted: bool = False
) -> List[Comment]:
    """
    获取帖子的评论列表
    """
    statement = select(Comment).where(Comment.post_id == post_id)
    
    if not include_deleted:
        statement = statement.where(Comment.is_deleted == False)
    
    # 消除 N+1：预加载作者信息
    # 注意：需要导入 User 模型以支持 relationship
    # 消除 N+1
    statement = statement.options(joinedload(Comment.author))
    statement = statement.offset(skip).limit(limit).order_by(Comment.created_at.desc())
    return list(db.exec(statement).all())

def get_replies(
    db: Session,
    parent_id: int,
    skip: int = 0,
    limit: int = 50
) -> List[Comment]:
    """
    获取某条评论的回复列表
    """
    statement = (
        select(Comment)
        .where(Comment.parent_id == parent_id, Comment.is_deleted == False)
        .offset(skip)
        .limit(limit)
        .order_by(Comment.created_at)
    )
    return list(db.exec(statement).all())

def update(
    db: Session,
    *,
    db_obj: Comment,
    obj_in: CommentUpdate
) -> Comment:
    """
    更新评论内容
    """
    from datetime import datetime
    db_obj.content = obj_in.content
    db_obj.updated_at = datetime.utcnow()
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete(db: Session, *, comment_id: int) -> bool:
    """
    软删除评论
    """
    comment = db.get(Comment, comment_id)
    if comment:
        comment.is_deleted = True
        db.add(comment)
        db.commit()
        return True
    return False

def increment_likes(db: Session, comment_id: int) -> Optional[Comment]:
    """
    评论点赞数 +1
    """
    comment = db.get(Comment, comment_id)
    if comment:
        comment.likes += 1
        db.add(comment)
        db.commit()
        db.refresh(comment)
    return comment

def toggle_like(db: Session, *, comment_id: int, user_id: int):
    """
    切换评论点赞状态（已点赞则取消，未点赞则添加）
    返回 (comment, liked: bool)
    """
    comment = db.get(Comment, comment_id)
    if not comment:
        return None, False

    statement = select(CommentLike).where(
        CommentLike.comment_id == comment_id,
        CommentLike.user_id == user_id
    )
    existing = db.exec(statement).first()
    if existing:
        # 取消点赞
        db.delete(existing)
        comment.likes = max(0, comment.likes - 1)
        liked = False
    else:
        # 添加点赞
        like = CommentLike(comment_id=comment_id, user_id=user_id)
        db.add(like)
        comment.likes += 1
        liked = True

    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment, liked

def add_like(db: Session, *, comment_id: int, user_id: int) -> Optional[Comment]:
    """@deprecated: 请使用 toggle_like"""
    comment, _ = toggle_like(db, comment_id=comment_id, user_id=user_id)
    return comment

def get_comment_count(db: Session, post_id: int) -> int:
    """
    获取帖子的评论总数
    """
    statement = select(func.count(Comment.id)).where(
        Comment.post_id == post_id,
        Comment.is_deleted == False
    )
    return int(db.exec(statement).one())
