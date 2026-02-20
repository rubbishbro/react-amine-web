"""
验证码存储后端
- 配置了 REDIS_URL：使用 Redis（多进程安全、重启不丢失）
- 未配置 REDIS_URL：退回内存字典（开发环境可用）

使用方式:
    from app.core.code_store import code_store
    code_store.set(key, payload, ttl_seconds)
    payload = code_store.get(key)
    code_store.delete(key)
"""

import json
import logging
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ─── 内存实现（降级模式）─────────────────────────────────────────────────

class _MemoryStore:
    """线程安全的内存 KV 存储，仅在无 Redis 时使用。"""

    def __init__(self) -> None:
        self._data: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()

    def set(self, key: str, value: Dict[str, Any], ttl_seconds: int) -> None:
        expire_ts = datetime.now(timezone.utc).timestamp() + ttl_seconds
        with self._lock:
            self._data[key] = {"value": value, "expire_ts": expire_ts}

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            entry = self._data.get(key)
            if not entry:
                return None
            if datetime.now(timezone.utc).timestamp() > entry["expire_ts"]:
                del self._data[key]
                return None
            return entry["value"]

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    @property
    def backend_name(self) -> str:
        return "memory"


# ─── Redis 实现 ────────────────────────────────────────────────────────────

class _RedisStore:
    """使用 Redis 做后端，支持 TTL，多进程/多实例安全。"""

    def __init__(self, redis_url: str) -> None:
        import redis as redis_lib
        self._client = redis_lib.from_url(redis_url, decode_responses=True)
        # 连通性测试
        self._client.ping()
        logger.info("[code_store] Redis 连接成功: %s", redis_url)

    def set(self, key: str, value: Dict[str, Any], ttl_seconds: int) -> None:
        self._client.setex(f"email_code:{key}", ttl_seconds, json.dumps(value, default=str))

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        raw = self._client.get(f"email_code:{key}")
        if raw is None:
            return None
        return json.loads(raw)

    def delete(self, key: str) -> None:
        self._client.delete(f"email_code:{key}")

    @property
    def backend_name(self) -> str:
        return "redis"


# ─── 工厂函数（在模块加载时决定使用哪个后端）──────────────────────────────

def _create_store():
    from app.core.config import settings
    url = (settings.REDIS_URL or "").strip()
    if url:
        try:
            return _RedisStore(url)
        except Exception as e:
            logger.warning(
                "[code_store] Redis 连接失败 (%s)，退回内存模式。"
                "生产环境请确保 Redis 可用。", e
            )
    else:
        logger.info("[code_store] 未配置 REDIS_URL，使用内存模式（不适合多进程部署）。")
    return _MemoryStore()


# 全局单例，应用启动时初始化一次
code_store = _create_store()
