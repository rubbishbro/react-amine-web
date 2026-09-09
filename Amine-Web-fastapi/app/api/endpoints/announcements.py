"""
系统公告 API 端点
路由前缀: /notifications/announcements
"""
from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlmodel import Session, select
from pydantic import BaseModel, ConfigDict, Field

from app.api import deps
from app.models.announcement import Announcement
from app.models.user import User

router = APIRouter()


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    content: str = Field(min_length=1, max_length=5000)

    model_config = ConfigDict(extra="forbid")


class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("", response_model=List[AnnouncementOut])
def list_announcements(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=20, ge=1, le=50),
) -> Any:
    """读取最新公告（登录用户可见，用于与通知同列表展示）。"""
    stmt = (
        select(Announcement)
        .order_by(Announcement.created_at.desc(), Announcement.id.desc())
        .offset(skip)
        .limit(limit)
    )
    return db.exec(stmt).all()


@router.post("", response_model=AnnouncementOut)
def create_announcement(
    *,
    db: Session = Depends(deps.get_db),
    payload: AnnouncementIn,
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """发布系统公告（仅管理员）。"""
    obj = Announcement(
        title=payload.title,
        content=payload.content,
        author_id=current_user.id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{announcement_id}")
def delete_announcement(
    *,
    db: Session = Depends(deps.get_db),
    announcement_id: int = Path(gt=0),
    current_user: User = Depends(deps.get_current_superuser),
) -> Any:
    """删除公告（仅管理员）。"""
    obj = db.get(Announcement, announcement_id)
    if not obj:
        raise HTTPException(status_code=404, detail="公告不存在")
    db.delete(obj)
    db.commit()
    return {"message": "公告已删除"}
