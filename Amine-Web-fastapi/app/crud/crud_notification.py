"""
通知 CRUD
"""
from typing import List, Optional
from datetime import datetime
from sqlmodel import Session, select, func
from app.models.notification import Notification, NotificationType


def create(
    db: Session,
    *,
    recipient_id: int,
    type: NotificationType,
    sender_id: Optional[int] = None,
    post_id: Optional[int] = None,
    comment_id: Optional[int] = None,
    content: Optional[str] = None,
) -> Notification:
    """创建一条通知。不向自己发送通知（sender == recipient 时跳过）。"""
    if sender_id is not None and sender_id == recipient_id:
        # 不给自己推送通知，返回哑对象用于接口层统一返回
        dummy = Notification(
            recipient_id=recipient_id,
            sender_id=sender_id,
            type=type,
            post_id=post_id,
            comment_id=comment_id,
            content=content,
        )
        return dummy
    obj = Notification(
        recipient_id=recipient_id,
        sender_id=sender_id,
        type=type,
        post_id=post_id,
        comment_id=comment_id,
        content=content,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_by_recipient(
    db: Session,
    *,
    recipient_id: int,
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
) -> List[Notification]:
    """获取某用户的通知列表（最新在前）。"""
    stmt = select(Notification).where(Notification.recipient_id == recipient_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
    stmt = stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    return db.exec(stmt).all()


def get_unread_count(db: Session, *, recipient_id: int) -> int:
    """获取未读通知数量。"""
    stmt = select(func.count()).where(
        Notification.recipient_id == recipient_id,
        Notification.is_read == False,
    )
    return db.exec(stmt).one()


def mark_read(db: Session, *, notification_id: int, recipient_id: int) -> Optional[Notification]:
    """将单条通知标为已读。"""
    obj = db.get(Notification, notification_id)
    if not obj or obj.recipient_id != recipient_id:
        return None
    obj.is_read = True
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def mark_all_read(db: Session, *, recipient_id: int) -> int:
    """将该用户所有未读通知标为已读，返回影响行数。"""
    objs = db.exec(
        select(Notification).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read == False,
        )
    ).all()
    for obj in objs:
        obj.is_read = True
        db.add(obj)
    db.commit()
    return len(objs)


def delete_read(db: Session, *, recipient_id: int) -> int:
    """清除该用户所有已读通知，返回删除数量。"""
    objs = db.exec(
        select(Notification).where(
            Notification.recipient_id == recipient_id,
            Notification.is_read == True,
        )
    ).all()
    for obj in objs:
        db.delete(obj)
    db.commit()
    return len(objs)
