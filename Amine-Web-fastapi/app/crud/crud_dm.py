"""
私信 CRUD
"""
from typing import List, Optional, Dict
from sqlmodel import Session, select, or_, and_, func
from app.models.direct_message import DirectMessage
from app.models.user import User


def send(
    db: Session,
    *,
    sender_id: int,
    receiver_id: int,
    content: str,
) -> DirectMessage:
    """发送一条私信。"""
    obj = DirectMessage(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content.strip(),
    )
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
    """
    # 找出与该用户有过会话的所有对方 ID
    stmt = select(DirectMessage).where(
        or_(DirectMessage.sender_id == user_id, DirectMessage.receiver_id == user_id)
    ).order_by(DirectMessage.created_at.desc())
    all_msgs = db.exec(stmt).all()

    seen: Dict[int, Dict] = {}
    for msg in all_msgs:
        other = msg.receiver_id if msg.sender_id == user_id else msg.sender_id
        if other not in seen:
            seen[other] = {"other_id": other, "last_message": msg, "unread_count": 0}

    # 将 other_id 映射为 username
    other_ids = list(seen.keys())
    users: Dict[int, User] = {}
    if other_ids:
        user_rows = db.exec(select(User).where(User.id.in_(other_ids))).all()
        users = {u.id: u for u in user_rows}

    # 统计未读数（对方发给 user_id 且未读的）
    unread_stmt = select(DirectMessage).where(
        DirectMessage.receiver_id == user_id,
        DirectMessage.is_read == False,
        DirectMessage.recalled == False,
    )
    unread_msgs = db.exec(unread_stmt).all()
    for msg in unread_msgs:
        if msg.sender_id in seen:
            seen[msg.sender_id]["unread_count"] += 1

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
