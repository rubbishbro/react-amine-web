"""Redis-backed, route-group rate limiting for every API endpoint."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from hashlib import sha256
from typing import Optional

from fastapi import Request
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import settings
from app.core import security

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LimitPolicy:
    name: str
    window_seconds: int
    ip_limit: int
    user_limit: Optional[int] = None


_CHECK_AND_EXPIRE = """
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
"""


def _policy_for(request: Request) -> LimitPolicy:
    path = request.url.path.rstrip("/") or "/"
    method = request.method.upper()

    if path.startswith(f"{settings.API_V1_STR}/search"):
        return LimitPolicy("search", 60, 20)
    if path in {
        f"{settings.API_V1_STR}/login/access-token",
        f"{settings.API_V1_STR}/auth/login",
    }:
        return LimitPolicy("login", 60, 20)
    if path == f"{settings.API_V1_STR}/auth/refresh":
        return LimitPolicy("session_refresh", 60, 60, 30)
    if path == f"{settings.API_V1_STR}/auth/email-code/send":
        return LimitPolicy("email_code", 60, 5)
    if path == f"{settings.API_V1_STR}/admin/activate":
        return LimitPolicy("admin_activate", 3600, 6, 3)
    if path.startswith(f"{settings.API_V1_STR}/upload") or path.startswith(
        f"{settings.API_V1_STR}/dm_upload/upload"
    ):
        return LimitPolicy("upload", 600, 30, 5)
    if path == f"{settings.API_V1_STR}/posts" and method == "POST":
        return LimitPolicy("post_create", 600, 25, 5)
    if path.startswith(f"{settings.API_V1_STR}/posts/") and method in {"PUT", "DELETE"}:
        return LimitPolicy("post_change", 600, 150, 30)
    if path == f"{settings.API_V1_STR}/comments" and method == "POST":
        return LimitPolicy("comment_create", 300, 100, 20)
    if path.startswith(f"{settings.API_V1_STR}/comments/") and method in {"PUT", "DELETE"}:
        return LimitPolicy("comment_change", 300, 150, 30)
    if path == f"{settings.API_V1_STR}/dm/send":
        return LimitPolicy("dm_send", 60, 150, 30)
    if path in {
        f"{settings.API_V1_STR}/users/me",
        f"{settings.API_V1_STR}/users/me/avatar",
    } and method == "PATCH":
        return LimitPolicy("profile_change", 600, 50, 10)
    if method in {"POST", "PUT", "PATCH", "DELETE"}:
        return LimitPolicy("authenticated_write", 60, 180, 60)
    return LimitPolicy("read", 60, 120, 180)


def _client_ip(request: Request) -> str:
    # Uvicorn only accepts proxy headers from the local Nginx connection.
    # Parsing forwarded headers again would make the limiter spoofable.
    return request.client.host if request.client else "unknown"


def _authenticated_user_id(request: Request) -> Optional[str]:
    authorization = request.headers.get("authorization", "")
    token = (
        authorization.split(" ", 1)[1].strip()
        if authorization.lower().startswith("bearer ")
        else request.cookies.get(settings.ACCESS_COOKIE_NAME, "")
    )
    if not token:
        return None
    try:
        payload = security.decode_access_token(token)
        subject = payload.get("sub")
        return str(int(subject)) if subject is not None else None
    except (TypeError, ValueError):
        return None


def _key(policy: LimitPolicy, identity_type: str, identity: str) -> str:
    digest = sha256(identity.encode("utf-8", errors="ignore")).hexdigest()[:32]
    return f"amine:ratelimit:{policy.name}:{identity_type}:{digest}"


async def create_redis_client() -> Optional[Redis]:
    if not settings.REDIS_URL:
        return None
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    await client.ping()
    return client


class SecurityRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method == "OPTIONS" or not request.url.path.startswith(settings.API_V1_STR):
            return await call_next(request)

        client: Optional[Redis] = getattr(request.app.state, "security_redis", None)
        if client is None:
            if settings.ENVIRONMENT.lower() == "production":
                if request.method in {"GET", "HEAD"}:
                    response = await call_next(request)
                    response.headers["X-RateLimit-Status"] = "degraded"
                    return response
                return JSONResponse(
                    status_code=503,
                    content={"detail": "Security service temporarily unavailable"},
                    headers={"Retry-After": "30"},
                )
            return await call_next(request)

        policy = _policy_for(request)
        checks = [("ip", _client_ip(request), policy.ip_limit)]
        user_id = _authenticated_user_id(request)
        if user_id and policy.user_limit:
            checks.append(("user", user_id, policy.user_limit))

        try:
            for identity_type, identity, limit in checks:
                current, ttl = await client.eval(
                    _CHECK_AND_EXPIRE,
                    1,
                    _key(policy, identity_type, identity),
                    policy.window_seconds,
                )
                if int(current) > limit:
                    retry_after = max(int(ttl), 1)
                    logger.warning(
                        "security_rate_limit_exceeded policy=%s identity=%s",
                        policy.name,
                        identity_type,
                    )
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many requests"},
                        headers={"Retry-After": str(retry_after)},
                    )
        except Exception:
            logger.exception("Redis rate limiter unavailable")
            if request.method not in {"GET", "HEAD"}:
                return JSONResponse(
                    status_code=503,
                    content={"detail": "Security service temporarily unavailable"},
                    headers={"Retry-After": "30"},
                )

        return await call_next(request)
