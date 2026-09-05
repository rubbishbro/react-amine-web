"""
私信 CRUD
"""
from typing import List, Optional, Dict
from uuid import UUID
from sqlmodel import Session, select, or_, and_, func
from app.models.direct_message import DirectMessage
from app.models.user import User
from app.models.dm_attachment import DMAttachment


def send(
    db: Session,
    *,
    sender_id: int,
    receiver_id: int,
    content: str,
    attachment: Optional[DMAttachment] = None,
) -> DirectMessage:
    """发送一条私信。"""
    obj = DirectMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content.strip(),
        attachment_id=attachment.id if attachment else None,
    )
    if attachment:
        attachment.receiver_id = receiver_id
        db.add(attachment)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_thread(
    db: Session,
    *,
    user_a: int,
    user_b: int,
    skip: int = 0,
    limit: int = 50,
) -> List[DirectMessage]:
    """获取两人之间的私信记录（最新在前）。"""
    stmt = (
        select(DirectMessage)
        .where(
            or_(
                and_(DirectMessage.sender_id == user_a, DirectMessage.receiver_id == user_b),
                and_(DirectMessage.sender_id == user_b, DirectMessage.receiver_id == user_a),
            )
        )
        .order_by(DirectMessage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = db.exec(stmt).all()
    rows.reverse()  # 返回正序（旧→新）
    return rows


def get_threads_list(db: Session, *, user_id: int) -> List[Dict]:
    """
    获取某用户的所有会话列表（每个会话只取最新一条消息）。
    返回 list[dict]: { other_id, last_message, unread_count }
    仅加载每个会话的最新一条消息和未读聚合，避免把全部私信拉进内存。
    """
    from sqlalchemy import case

    # 会话另一方（参与双方中不是当前用户的那一个）
    other_expr = case(
        (DirectMessage.sender_id == user_id, DirectMessage.receiver_id),
        else_=DirectMessage.sender_id,
    )
    involved = or_(
        DirectMessage.sender_id == user_id,
        DirectMessage.receiver_id == user_id,
    )

    # 每个会话按时间倒序编号，只保留最新一条（rn = 1）
    ranked = (
        select(
            DirectMessage.id.label("msg_id"),
            other_expr.label("other_id"),
            func.row_number()
            .over(
                partition_by=other_expr,
                order_by=(DirectMessage.created_at.desc(), DirectMessage.id.desc()),
            )
            .label("rn"),
        )
        .where(involved)
        .subquery()
    )
    latest_ids = select(ranked.c.msg_id).where(ranked.c.rn == 1)
    latest_msgs = db.exec(
        select(DirectMessage)
        .where(DirectMessage.id.in_(latest_ids))
        .order_by(DirectMessage.created_at.desc(), DirectMessage.id.desc())
    ).all()

    seen: Dict[int, Dict] = {}
    for msg in latest_msgs:
        other = msg.receiver_id if msg.sender_id == user_id else msg.sender_id
        if other not in seen:
            seen[other] = {"other_id": other, "last_message": msg, "unread_count": 0}

    # 将 other_id 映射为 username
    other_ids = list(seen.keys())
    users: Dict[int, User] = {}
    if other_ids:
        user_rows = db.exec(select(User).where(User.id.in_(other_ids))).all()
        users = {u.id: u for u in user_rows}

    # 统计未读数（对方发给 user_id 且未读的），按发送方分组聚合
    unread_rows = db.execute(
        select(DirectMessage.sender_id, func.count())
        .where(
            DirectMessage.receiver_id == user_id,
            DirectMessage.is_read == False,
            DirectMessage.recalled == False,
        )
        .group_by(DirectMessage.sender_id)
    ).all()
    for sender_id, count in unread_rows:
        if sender_id in seen:
            seen[sender_id]["unread_count"] += int(count)

    # 将用户名写入结果
    for other_id, entry in seen.items():
        other_user = users.get(other_id)
        entry["other_name"] = other_user.username if other_user else str(other_id)

    return list(seen.values())


def mark_thread_read(db: Session, *, reader_id: int, sender_id: int) -> int:
    """将某人发给 reader_id 的所有未读消息标为已读，返回影响条数。"""
    objs = db.exec(
        select(DirectMessage).where(
            DirectMessage.sender_id == sender_id,
            DirectMessage.receiver_id == reader_id,
            DirectMessage.is_read == False,
        )
    ).all()
    for obj in objs:
        obj.is_read = True
        db.add(obj)
    db.commit()
    return len(objs)


def recall(db: Session, *, message_id: int, sender_id: int) -> Optional[DirectMessage]:
    """撤回消息（只有发送方可以撤回）。"""
    obj = db.get(DirectMessage, message_id)
    if not obj or obj.sender_id != sender_id:
        return None
    obj.recalled = True
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete_for_me(db: Session, *, message_id: int, user_id: int) -> bool:
    """
    仅在自己视角删除一条消息（发送方或接收方均可操作，
    此处简单实现：直接从 DB 删除，双方同步消失）。
    实际更大项目可改用软删除字段。
    """
    obj = db.get(DirectMessage, message_id)
    if not obj:
        return False
    if obj.sender_id != user_id and obj.receiver_id != user_id:
        return False
    db.delete(obj)
    db.commit()
    return True


def get_total_unread(db: Session, *, user_id: int) -> int:
    """获取该用户所有未读私信总数（用于 badge）。"""
    stmt = select(func.count()).where(
        DirectMessage.receiver_id == user_id,
        DirectMessage.is_read == False,
        DirectMessage.recalled == False,
    )
    return db.exec(stmt).one()
