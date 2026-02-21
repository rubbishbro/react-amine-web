"""
私信图片上传 API 端点
路由前缀：/dm_upload
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Request
import os
import uuid
import asyncio
from typing import Any
from fastapi.responses import StreamingResponse
import httpx
import io

from app.core.limiter import limiter
from app.core.config import settings
from app.models.user import User
from app.api import deps

router = APIRouter()

UPLOAD_DIR = "static/dm_upload"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".mp3", ".wav", ".mp4"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

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
    return f"{settings.QINIU_DOMAIN.rstrip('/')}/{key}"

def _local_upload(data: bytes, filename: str) -> str:
    """保存到本地 static/dm_upload，返回相对 URL。"""
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)
    return path

@router.post("/upload")
@limiter.limit("30/minute")  # 防止大量上传耗尽存储空间
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    上传图片或音频。
    - 配置了七牛云：存至七牛 CDN，返回公开 URL
    - 未配置：存至本地 static/dm_upload，返回相对路径
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"文件类型不支持，可用: {ALLOWED_EXTENSIONS}")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"文件超过 {MAX_FILE_SIZE // 1024 // 1024}MB 限制")

    key = f"dm_upload/{uuid.uuid4().hex}{ext}"

    try:
        if _qiniu_enabled:
            url = await asyncio.to_thread(_qiniu_upload_sync, data, key)
        else:
            url = _local_upload(data, os.path.basename(key))
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _qiniu_download_sync(key: str):
    """同步从七牛云下载，返回文件流。"""
    from qiniu import Auth  # 延迟导入，未安装 qiniu 时不影响启动
    q = Auth(settings.QINIU_ACCESS_KEY, settings.QINIU_SECRET_KEY)
    private_url = q.private_download_url(key, expires=3600)
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://" + private_url)
            if response.status_code == 200:
                return StreamingResponse(response.iter_bytes(), media_type=response.headers['Content-Type'])
            else:
                raise HTTPException(status_code=response.status_code, detail="Image not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _local_download(key: str,media_type: str):
    """调取相对路径中的文件，返回文件。"""
    with open(key, "rb") as f:
        return StreamingResponse(io.BytesIO(f.read()), media_type=media_type)

@router.get("/download")
@limiter.limit("30/minute")  # 防止大量下载耗尽存储空间
async def download_file(
    request: Request,
    key: str,
    media_type: str, 
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
        if _qiniu_enabled:
            file = await _qiniu_download_sync(key)
        else:
            file = _local_download(key, media_type)
        return file
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))