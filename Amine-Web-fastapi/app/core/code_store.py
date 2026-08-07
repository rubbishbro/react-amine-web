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

    def acquire_send_lock(self, key: str, ttl_seconds: int = 30) -> bool:
        lock_key = f"lock:{key}"
        with self._lock:
            entry = self._data.get(lock_key)
            now = datetime.now(timezone.utc).timestamp()
            if entry and entry["expire_ts"] > now:
                return False
            self._data[lock_key] = {"value": {}, "expire_ts": now + ttl_seconds}
            return True

    def release_send_lock(self, key: str) -> None:
        with self._lock:
            self._data.pop(f"lock:{key}", None)

    def verify(self, key: str, code: str, max_attempts: int = 5) -> str:
        with self._lock:
            entry = self._data.get(key)
            if not entry:
                return "missing"
            if datetime.now(timezone.utc).timestamp() > entry["expire_ts"]:
                self._data.pop(key, None)
                return "missing"
            payload = entry["value"]
            if payload.get("code") == code:
                return "ok"
            payload["attempts"] = int(payload.get("attempts", 0)) + 1
            if payload["attempts"] >= max_attempts:
                self._data.pop(key, None)
                return "locked"
            return "invalid"

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

    def acquire_send_lock(self, key: str, ttl_seconds: int = 30) -> bool:
        return bool(
            self._client.set(f"email_code_lock:{key}", "1", ex=ttl_seconds, nx=True)
        )

    def release_send_lock(self, key: str) -> None:
        self._client.delete(f"email_code_lock:{key}")

    def verify(self, key: str, code: str, max_attempts: int = 5) -> str:
        script = """
        local raw = redis.call('GET', KEYS[1])
        if not raw then return 'missing' end
        local payload = cjson.decode(raw)
        if payload['code'] == ARGV[1] then return 'ok' end
        local attempts = tonumber(payload['attempts'] or 0) + 1
        if attempts >= tonumber(ARGV[2]) then
            redis.call('DEL', KEYS[1])
            return 'locked'
        end
        payload['attempts'] = attempts
        local ttl = redis.call('TTL', KEYS[1])
        if ttl > 0 then redis.call('SETEX', KEYS[1], ttl, cjson.encode(payload)) end
        return 'invalid'
        """
        return self._client.eval(
            script, 1, f"email_code:{key}", (code or "").strip(), max_attempts
        )

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
