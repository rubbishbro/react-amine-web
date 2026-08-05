"""
私信图片上传 API 端点
路由前缀：/dm_upload
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Request, Query
import os
import uuid
import asyncio
import mimetypes
import re
from pathlib import Path
from typing import Any
from fastapi.responses import FileResponse, Response
import httpx
from sqlmodel import Session, select

from app.core.limiter import limiter
from app.core.config import settings
from app.core.file_validation import validate_media_upload
from app.models.user import User
from app.models.dm_attachment import DMAttachment
from app.api import deps

router = APIRouter()

UPLOAD_DIR = Path("private/dm_upload")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".mp3", ".wav", ".mp4"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
SAFE_FILENAME = re.compile(
    r"^[0-9a-f]{32}\.(?:jpg|jpeg|png|gif|mp3|wav|mp4)$", re.IGNORECASE
)

# 检测是否已配置七牛云
_qiniu_enabled = bool(
    settings.QINIU_ACCESS_KEY
    and settings.QINIU_SECRET_KEY
    and settings.QINIU_BUCKET_NAME
    and settings.QINIU_DOMAIN
)


def _qiniu_upload_sync(data: bytes, key: str) -> str:
    """同步上传到七牛云，返回公开地址。通过 asyncio.to_thread 调用。"""
    from qiniu import Auth, put_data  # 延迟导入，未安装 qiniu 时不影响启动
    q = Auth(settings.QINIU_ACCESS_KEY, settings.QINIU_SECRET_KEY)
    token = q.upload_token(settings.QINIU_BUCKET_NAME, key, 3600)
    ret, info = put_data(token, key, data)
    if info.status_code != 200:
        raise RuntimeError(f"七牛上传失败: {info.error}")
    return key

def _local_upload(data: bytes, filename: str) -> str:
    """保存到本地 static/dm_upload，返回相对 URL。"""
    path = UPLOAD_DIR / filename
    with open(path, "wb") as f:
        f.write(data)
    return f"dm_upload/{filename}"


def _normalize_key(key: str) -> tuple[str, str]:
    """Return a safe object key and filename, rejecting path traversal."""
    normalized = (key or "").strip().replace("\\", "/").lstrip("/")
    for prefix in ("static/dm_upload/", "private/dm_upload/"):
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
            break
    if normalized.startswith("dm_upload/"):
        normalized = normalized[len("dm_upload/"):]
    if not normalized or "/" in normalized or not SAFE_FILENAME.fullmatch(normalized):
        raise HTTPException(status_code=400, detail="Invalid file key")
    ext = Path(normalized).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")
    return f"dm_upload/{normalized}", normalized

@router.post("/upload")
@limiter.limit("30/minute")  # 防止大量上传耗尽存储空间
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    上传图片或音频。
    - 配置了七牛云：存至七牛 CDN，返回公开 URL
    - 未配置：存至本地 static/dm_upload，返回相对路径
    """
    media = await validate_media_upload(file, MAX_FILE_SIZE)

    key = f"dm_upload/{uuid.uuid4().hex}{media.extension}"

    try:
        if _qiniu_enabled:
            stored_key = await asyncio.to_thread(_qiniu_upload_sync, media.data, key)
        else:
            stored_key = _local_upload(media.data, os.path.basename(key))
        attachment = DMAttachment(
            storage_key=stored_key,
            owner_id=current_user.id,
            mime_type=media.media_type,
            size=len(media.data),
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        return {
            "attachment_id": str(attachment.id),
            "key": stored_key,
            "url": f"/api/v1/dm_upload/download?key={stored_key}",
        }
    except Exception:
        raise HTTPException(status_code=500, detail="File upload failed")

async def _qiniu_download(key: str) -> Response:
    """同步从七牛云下载，返回文件流。"""
    from qiniu import Auth  # 延迟导入，未安装 qiniu 时不影响启动
    q = Auth(settings.QINIU_ACCESS_KEY, settings.QINIU_SECRET_KEY)
    public_url = f"{settings.QINIU_DOMAIN.rstrip('/')}/{key}"
    private_url = q.private_download_url(public_url, expires=3600)
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
            response = await client.get(private_url)
            if response.status_code == 200:
                return Response(
                    content=response.content,
                    media_type=response.headers.get("Content-Type", "application/octet-stream"),
                    headers={"Content-Disposition": "inline"},
                )
            else:
                raise HTTPException(status_code=response.status_code, detail="Image not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="File storage is unavailable")

def _local_download(filename: str) -> FileResponse:
    """调取相对路径中的文件，返回文件。"""
    root = UPLOAD_DIR.resolve()
    path = (root / filename).resolve()
    if path.parent != root or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type, content_disposition_type="inline")

@router.get("/download")
@limiter.limit("30/minute")  # 防止大量下载耗尽存储空间
async def download_file(
    request: Request,
    key: str = Query(min_length=1, max_length=128),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    下载图片或音频。
    - 配置了七牛云：从七牛 CDN下载，返回文件流
    - 未配置：从本地 static/dm_upload获取，返回文件流
    key:从upload_file获取的URL中的路径部分
    media_type:#仅开发环境时必配
    - audio/mpeg: 音频
    - image/jpeg: jpg图片
    """
    try:
        safe_key, filename = _normalize_key(key)
        attachment = db.exec(
            select(DMAttachment).where(DMAttachment.storage_key == safe_key)
        ).first()
        if not attachment or current_user.id not in {
            attachment.owner_id,
            attachment.receiver_id,
        }:
            raise HTTPException(status_code=404, detail="File not found")
        if _qiniu_enabled:
            file = await _qiniu_download(safe_key)
        else:
            file = _local_download(filename)
        return file
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="File download failed") from e
