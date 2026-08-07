"""Redis-backed browser sessions, refresh rotation, and one-time tickets."""

from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import dataclass
from threading import RLock
from time import time
from typing import Any, Optional

from app.core.config import settings


class SessionUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class BrowserSession:
    sid: str
    user_id: int
    refresh_token: str
    csrf_token: str


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class AuthSessionStore:
    def __init__(self) -> None:
        self._redis = None
        self._memory: dict[str, tuple[dict[str, Any], float]] = {}
        self._lock = RLock()
        if settings.REDIS_URL:
            import redis

            self._redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    @property
    def ttl_seconds(self) -> int:
        return settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

    def ping(self) -> None:
        if self._redis is None:
            if settings.ENVIRONMENT.lower() == "production":
                raise SessionUnavailable("Redis is required for browser sessions")
            return
        try:
            self._redis.ping()
        except Exception as error:
            raise SessionUnavailable("session store is unavailable") from error

    def _session_key(self, sid: str) -> str:
        return f"auth:session:{sid}"

    def _user_key(self, user_id: int) -> str:
        return f"auth:user:{user_id}:sessions"

    def _memory_cleanup(self) -> None:
        now = time()
        for key, (_, expires_at) in list(self._memory.items()):
            if expires_at <= now:
                self._memory.pop(key, None)

    def _put(self, sid: str, payload: dict[str, Any]) -> None:
        if self._redis is not None:
            try:
                pipe = self._redis.pipeline(transaction=True)
                pipe.setex(self._session_key(sid), self.ttl_seconds, json.dumps(payload))
                pipe.sadd(self._user_key(int(payload["user_id"])), sid)
                pipe.expire(self._user_key(int(payload["user_id"])), self.ttl_seconds)
                pipe.execute()
                return
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            self._memory_cleanup()
            self._memory[sid] = (payload, time() + self.ttl_seconds)

    def _get(self, sid: str) -> Optional[dict[str, Any]]:
        if not sid:
            return None
        if self._redis is not None:
            try:
                raw = self._redis.get(self._session_key(sid))
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
            return json.loads(raw) if raw else None
        with self._lock:
            self._memory_cleanup()
            entry = self._memory.get(sid)
            return dict(entry[0]) if entry else None

    def create(self, user_id: int) -> BrowserSession:
        sid = secrets.token_urlsafe(24)
        refresh_secret = secrets.token_urlsafe(48)
        csrf_token = secrets.token_urlsafe(32)
        self._put(
            sid,
            {
                "user_id": int(user_id),
                "refresh_hash": _digest(refresh_secret),
                "csrf_hash": _digest(csrf_token),
            },
        )
        return BrowserSession(
            sid=sid,
            user_id=int(user_id),
            refresh_token=f"{sid}.{refresh_secret}",
            csrf_token=csrf_token,
        )

    def validate(self, sid: str, user_id: int) -> bool:
        payload = self._get(sid)
        return bool(payload and int(payload.get("user_id", -1)) == int(user_id))

    def verify_csrf(self, sid: str, csrf_token: str) -> bool:
        payload = self._get(sid)
        expected = payload.get("csrf_hash") if payload else ""
        return bool(expected and secrets.compare_digest(expected, _digest(csrf_token or "")))

    @staticmethod
    def refresh_sid(refresh_token: str) -> str:
        if not refresh_token or "." not in refresh_token:
            return ""
        return refresh_token.split(".", 1)[0]

    def rotate(self, refresh_token: str) -> BrowserSession:
        sid = self.refresh_sid(refresh_token)
        secret = refresh_token.split(".", 1)[1] if sid else ""
        refresh_secret = secrets.token_urlsafe(48)
        csrf_token = secrets.token_urlsafe(32)
        old_hash = _digest(secret)
        new_refresh_hash = _digest(refresh_secret)
        new_csrf_hash = _digest(csrf_token)

        if self._redis is not None:
            script = """
            local raw = redis.call('GET', KEYS[1])
            if not raw then return 0 end
            local payload = cjson.decode(raw)
            if payload['refresh_hash'] ~= ARGV[1] then
                redis.call('DEL', KEYS[1])
                redis.call('SREM', 'auth:user:' .. payload['user_id'] .. ':sessions', ARGV[5])
                return -1
            end
            payload['refresh_hash'] = ARGV[2]
            payload['csrf_hash'] = ARGV[3]
            redis.call('SETEX', KEYS[1], tonumber(ARGV[4]), cjson.encode(payload))
            redis.call('EXPIRE', 'auth:user:' .. payload['user_id'] .. ':sessions', tonumber(ARGV[4]))
            return tonumber(payload['user_id'])
            """
            try:
                user_id = int(
                    self._redis.eval(
                        script,
                        1,
                        self._session_key(sid),
                        old_hash,
                        new_refresh_hash,
                        new_csrf_hash,
                        self.ttl_seconds,
                        sid,
                    )
                )
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
            if user_id == 0:
                raise ValueError("invalid refresh token")
            if user_id == -1:
                raise ValueError("refresh token replay detected")
        else:
            with self._lock:
                self._memory_cleanup()
                entry = self._memory.get(sid)
                if not entry:
                    raise ValueError("invalid refresh token")
                payload = dict(entry[0])
                if not secrets.compare_digest(payload.get("refresh_hash", ""), old_hash):
                    self._memory.pop(sid, None)
                    raise ValueError("refresh token replay detected")
                user_id = int(payload["user_id"])
                payload["refresh_hash"] = new_refresh_hash
                payload["csrf_hash"] = new_csrf_hash
                self._memory[sid] = (payload, time() + self.ttl_seconds)
        return BrowserSession(
            sid=sid,
            user_id=user_id,
            refresh_token=f"{sid}.{refresh_secret}",
            csrf_token=csrf_token,
        )

    def revoke(self, sid: str) -> None:
        payload = self._get(sid)
        if self._redis is not None:
            try:
                pipe = self._redis.pipeline(transaction=True)
                pipe.delete(self._session_key(sid))
                if payload:
                    pipe.srem(self._user_key(int(payload["user_id"])), sid)
                pipe.execute()
                return
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            self._memory.pop(sid, None)

    def revoke_all(self, user_id: int) -> None:
        if self._redis is not None:
            try:
                user_key = self._user_key(user_id)
                session_ids = self._redis.smembers(user_key)
                pipe = self._redis.pipeline(transaction=True)
                for sid in session_ids:
                    pipe.delete(self._session_key(sid))
                pipe.delete(user_key)
                pipe.execute()
                return
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            for sid, (payload, _) in list(self._memory.items()):
                if int(payload.get("user_id", -1)) == int(user_id):
                    self._memory.pop(sid, None)

    def mark_legacy_migrated(self, token: str, ttl_seconds: int) -> bool:
        key = f"auth:migrated:{_digest(token)}"
        if self._redis is not None:
            try:
                return bool(self._redis.set(key, "1", ex=ttl_seconds, nx=True))
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            self._memory_cleanup()
            if key in self._memory:
                return False
            self._memory[key] = ({"value": 1}, time() + ttl_seconds)
            return True

    def _login_keys(self, identifier: str, client_ip: str) -> list[str]:
        normalized = (identifier or "").strip().lower()
        return [
            f"auth:login-fail:account:{_digest(normalized)}",
            f"auth:login-fail:ip:{_digest(client_ip or 'unknown')}",
        ]

    def login_retry_after(self, identifier: str, client_ip: str) -> int:
        now = int(time())
        keys = self._login_keys(identifier, client_ip)
        if self._redis is not None:
            try:
                values = [self._redis.hget(key, "blocked_until") for key in keys]
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
            return max([int(value or 0) - now for value in values] + [0])
        with self._lock:
            self._memory_cleanup()
            return max(
                [
                    int(self._memory.get(key, ({}, 0))[0].get("blocked_until", 0)) - now
                    for key in keys
                ]
                + [0]
            )

    def record_login_failure(self, identifier: str, client_ip: str) -> int:
        now = int(time())
        retry_after = 0
        for key in self._login_keys(identifier, client_ip):
            if self._redis is not None:
                try:
                    count = int(self._redis.hincrby(key, "count", 1))
                    delay = 900 if count >= 10 else 30 if count >= 5 else 0
                    if delay:
                        self._redis.hset(key, "blocked_until", now + delay)
                    self._redis.expire(key, 3600)
                except Exception as error:
                    raise SessionUnavailable("session store is unavailable") from error
            else:
                with self._lock:
                    payload = dict(self._memory.get(key, ({}, 0))[0])
                    count = int(payload.get("count", 0)) + 1
                    delay = 900 if count >= 10 else 30 if count >= 5 else 0
                    payload.update({"count": count, "blocked_until": now + delay})
                    self._memory[key] = (payload, time() + 3600)
            retry_after = max(retry_after, delay)
        return retry_after

    def clear_login_failures(self, identifier: str, client_ip: str) -> None:
        keys = self._login_keys(identifier, client_ip)
        if self._redis is not None:
            try:
                self._redis.delete(*keys)
                return
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            for key in keys:
                self._memory.pop(key, None)

    def issue_ws_ticket(self, user_id: int) -> tuple[str, int]:
        ticket = secrets.token_urlsafe(32)
        ttl = 60
        key = f"auth:ws-ticket:{_digest(ticket)}"
        if self._redis is not None:
            try:
                self._redis.setex(key, ttl, str(int(user_id)))
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        else:
            with self._lock:
                self._memory[key] = ({"user_id": int(user_id)}, time() + ttl)
        return ticket, ttl

    def consume_ws_ticket(self, ticket: str) -> Optional[int]:
        key = f"auth:ws-ticket:{_digest(ticket or '')}"
        if self._redis is not None:
            script = """
            local value = redis.call('GET', KEYS[1])
            if value then redis.call('DEL', KEYS[1]) end
            return value
            """
            try:
                value = self._redis.eval(script, 1, key)
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
            return int(value) if value else None
        with self._lock:
            self._memory_cleanup()
            entry = self._memory.pop(key, None)
            return int(entry[0]["user_id"]) if entry else None

    def acquire_ws_connection(self, user_id: int, client_ip: str) -> bool:
        user_key = f"auth:ws-connections:user:{user_id}"
        ip_key = f"auth:ws-connections:ip:{_digest(client_ip or 'unknown')}"
        if self._redis is not None:
            script = """
            local users = redis.call('INCR', KEYS[1])
            local ips = redis.call('INCR', KEYS[2])
            redis.call('EXPIRE', KEYS[1], 120)
            redis.call('EXPIRE', KEYS[2], 120)
            if users > 3 or ips > 50 then
                redis.call('DECR', KEYS[1])
                redis.call('DECR', KEYS[2])
                return 0
            end
            return 1
            """
            try:
                return bool(self._redis.eval(script, 2, user_key, ip_key))
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            self._memory_cleanup()
            user_count = int(self._memory.get(user_key, ({"count": 0}, 0))[0].get("count", 0))
            ip_count = int(self._memory.get(ip_key, ({"count": 0}, 0))[0].get("count", 0))
            if user_count >= 3 or ip_count >= 50:
                return False
            self._memory[user_key] = ({"count": user_count + 1}, time() + 120)
            self._memory[ip_key] = ({"count": ip_count + 1}, time() + 120)
            return True

    def release_ws_connection(self, user_id: int, client_ip: str) -> None:
        keys = [
            f"auth:ws-connections:user:{user_id}",
            f"auth:ws-connections:ip:{_digest(client_ip or 'unknown')}",
        ]
        if self._redis is not None:
            script = """
            for _, key in ipairs(KEYS) do
                local current = tonumber(redis.call('GET', key) or '0')
                if current <= 1 then redis.call('DEL', key) else redis.call('DECR', key) end
            end
            return 1
            """
            try:
                self._redis.eval(script, len(keys), *keys)
                return
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            for key in keys:
                entry = self._memory.get(key)
                count = int(entry[0].get("count", 0)) if entry else 0
                if count <= 1:
                    self._memory.pop(key, None)
                else:
                    self._memory[key] = ({"count": count - 1}, entry[1])

    def allow_ws_event(self, user_id: int) -> bool:
        now = int(time())
        keys = [
            f"auth:ws-events:10s:{user_id}:{now // 10}",
            f"auth:ws-events:60s:{user_id}:{now // 60}",
        ]
        if self._redis is not None:
            try:
                pipe = self._redis.pipeline(transaction=True)
                pipe.incr(keys[0])
                pipe.expire(keys[0], 20)
                pipe.incr(keys[1])
                pipe.expire(keys[1], 120)
                values = pipe.execute()
                return int(values[0]) <= 10 and int(values[2]) <= 60
            except Exception as error:
                raise SessionUnavailable("session store is unavailable") from error
        with self._lock:
            self._memory_cleanup()
            counts = []
            for key, ttl in zip(keys, (20, 120)):
                count = int(self._memory.get(key, ({"count": 0}, 0))[0].get("count", 0)) + 1
                self._memory[key] = ({"count": count}, time() + ttl)
                counts.append(count)
            return counts[0] <= 10 and counts[1] <= 60


session_store = AuthSessionStore()
