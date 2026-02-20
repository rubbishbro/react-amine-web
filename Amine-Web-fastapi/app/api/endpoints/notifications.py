"""
通知 API 端点
路由前缀: /notifications
"""
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from app.api import deps
from app.crud import crud_notification
from app.models.notification import Notification, NotificationType
from app.models.user import User

router = APIRouter()


# ── Schema ────────────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: Optional[int]
    recipient_id: int
    sender_id: Optional[int]
    type: NotificationType
    post_id: Optional[int]
    comment_id: Optional[int]
    content: Optional[str]
    is_read: bool
    created_at: Any  # datetime 序列化为 ISO string

    class Config:
        from_attributes = True


class PushNotificationIn(BaseModel):
    recipient_id: int
    type: NotificationType
    post_id: Optional[int] = None
    comment_id: Optional[int] = None
    content: Optional[str] = None


# ── 端点 ──────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[NotificationOut])
def list_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """获取当前用户的通知列表（最新在前）。"""
    return crud_notification.get_by_recipient(
        db,
        recipient_id=current_user.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
    )


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """获取未读通知数量（用于 badge）。"""
    count = crud_notification.get_unread_count(db, recipient_id=current_user.id)
    return {"unread_count": count}


@router.post("/push", response_model=NotificationOut)
def push_notification(
    payload: PushNotificationIn,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    产生一条通知（由触发动作的用户调用，例如点赞、回复后调用此接口）。
    current_user 为 sender，payload.recipient_id 为接收者。
    """
    notification = crud_notification.create(
        db,
        recipient_id=payload.recipient_id,
        sender_id=current_user.id,
        type=payload.type,
        post_id=payload.post_id,
        comment_id=payload.comment_id,
        content=payload.content,
    )
    return notification


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """将单条通知标为已读。"""
    obj = crud_notification.mark_read(
        db, notification_id=notification_id, recipient_id=current_user.id
    )
    if not obj:
        raise HTTPException(status_code=404, detail="通知不存在")
    return obj


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """将当前用户所有未读通知标为已读。"""
    count = crud_notification.mark_all_read(db, recipient_id=current_user.id)
    return {"marked": count}


@router.delete("/clear-read")
def clear_read(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """清除当前用户所有已读通知。"""
    deleted = crud_notification.delete_read(db, recipient_id=current_user.id)
    return {"deleted": deleted}
