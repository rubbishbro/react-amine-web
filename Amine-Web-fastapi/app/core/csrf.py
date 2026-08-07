"""CSRF and exact-Origin enforcement for browser Cookie sessions."""

import secrets

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core import security
from app.core.config import settings
from app.core.session_store import SessionUnavailable, session_store


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await call_next(request)

        allowed_origins = {str(item) for item in settings.BACKEND_CORS_ORIGINS}
        if request.url.path == f"{settings.API_V1_STR}/auth/login":
            if request.headers.get("origin", "") not in allowed_origins:
                return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})
            # Login creates a new session and must also recover from stale or
            # partially cleared cookies, so it uses Origin without old CSRF.
            return await call_next(request)

        authorization = request.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            return await call_next(request)

        access_token = request.cookies.get(settings.ACCESS_COOKIE_NAME, "")
        refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME, "")
        if not access_token and not refresh_token:
            return await call_next(request)

        origin = request.headers.get("origin", "")
        if origin not in allowed_origins:
            return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})

        sid = ""
        if access_token:
            try:
                sid = str(security.decode_access_token(access_token).get("sid") or "")
            except ValueError:
                sid = ""
        if not sid and refresh_token:
            sid = session_store.refresh_sid(refresh_token)

        csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME, "")
        csrf_header = request.headers.get("x-csrf-token", "")
        if not sid or not csrf_cookie or not csrf_header:
            return JSONResponse(status_code=403, content={"detail": "CSRF token required"})
        if not secrets.compare_digest(csrf_cookie, csrf_header):
            return JSONResponse(status_code=403, content={"detail": "CSRF token mismatch"})
        try:
            valid = session_store.verify_csrf(sid, csrf_header)
        except SessionUnavailable:
            return JSONResponse(
                status_code=503, content={"detail": "Session service unavailable"}
            )
        if not valid:
            return JSONResponse(status_code=403, content={"detail": "CSRF token invalid"})
        return await call_next(request)
