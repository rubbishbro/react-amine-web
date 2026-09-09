"""
统一媒体存储层：Cloudflare R2（S3 兼容）优先，其次七牛，最后本地。
公共上传走 put_public（返回公开 URL）；私信附件用 put_private + presign_get。
"""
from __future__ import annotations

from typing import Optional

from app.core.config import settings


def r2_enabled() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET
    )


def r2_public_base() -> str:
    return settings.R2_PUBLIC_DOMAIN.rstrip("/") if settings.R2_PUBLIC_DOMAIN else ""


def _r2_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def r2_put(key: str, data: bytes, content_type: Optional[str] = None) -> str:
    """上传对象，返回公开 URL（要求公开桶已绑定 R2_PUBLIC_DOMAIN）。"""
    client = _r2_client()
    put_kwargs = {"Bucket": settings.R2_BUCKET, "Key": key, "Body": data}
    if content_type:
        put_kwargs["ContentType"] = content_type
    client.put_object(**put_kwargs)
    return f"{r2_public_base()}/{key}"


def r2_presign_get(key: str, expires: int = 3600) -> str:
    """生成临时下载 URL（用于私信附件等私密对象）。"""
    client = _r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": key},
        ExpiresIn=expires,
    )
