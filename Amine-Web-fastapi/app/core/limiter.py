"""
全局速率限制器（slowapi）
在各端点通过 @limiter.limit("N/period") 装饰器使用。
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# 以客户端真实 IP 作为限速 key
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL or "memory://",
    # SlowAPI can only inject limit headers when every decorated endpoint
    # receives a Starlette Response instance. Several legacy account/upload
    # endpoints return plain models, so enabling injection turns successful
    # requests into HTTP 500 responses. Enforcement remains enabled; the
    # global security middleware owns the public 429/Retry-After response.
    headers_enabled=False,
)
