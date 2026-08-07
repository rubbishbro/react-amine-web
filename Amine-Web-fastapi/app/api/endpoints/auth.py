# 登录换token的API端点
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
import re
import secrets
import smtplib
from typing import Any

import logging
from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.crud import crud_user
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.code_store import code_store
from app.core.limiter import limiter
from app.core.session_store import SessionUnavailable, session_store
from app.models.user import User

logger = logging.getLogger(__name__)
from app.schemas.auth import (
    BrowserLoginRequest,
    EmailCodeSendRequest,
    EmailCodeSendResponse,
    PasswordResetByCodeRequest,
    RegisterByEmailRequest,
)
from app.schemas.token import Token
from app.schemas.user import User as UserSchema

router = APIRouter()

_PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$")
_DUMMY_PASSWORD_HASH = security.get_password_hash("DummyPassword9A")


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _validate_purpose(purpose: str) -> str:
    normalized = (purpose or "").strip()
    if normalized not in {"register", "reset_password"}:
        raise HTTPException(status_code=400, detail="purpose 仅支持 register 或 reset_password")
    return normalized


def _build_code_key(email: str, purpose: str) -> str:
    return f"{purpose}:{_normalize_email(email)}"


def _generate_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _validate_password_strength(password: str) -> None:
    if not _PASSWORD_PATTERN.match(password or ""):
        raise HTTPException(
            status_code=400,
            detail="密码必须至少8位，且包含大写字母、小写字母和数字",
        )


def _session_error(error: Exception) -> HTTPException:
    return HTTPException(status_code=503, detail="Session service unavailable")


def _cookie_domain() -> str | None:
    if settings.COOKIE_DOMAIN:
        return settings.COOKIE_DOMAIN
    if settings.ENVIRONMENT.lower() == "production":
        return ".lnssy-cykj.online"
    return None


def _set_session_cookies(response: Response, browser_session) -> None:
    secure = settings.ENVIRONMENT.lower() == "production"
    domain = _cookie_domain()
    access_token = security.create_access_token(
        {"sub": str(browser_session.user_id)},
        expires_delta=timedelta(minutes=settings.BROWSER_ACCESS_TOKEN_EXPIRE_MINUTES),
        session_id=browser_session.sid,
    )
    response.set_cookie(
        settings.ACCESS_COOKIE_NAME,
        access_token,
        max_age=settings.BROWSER_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path=settings.API_V1_STR,
        domain=domain,
    )
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        browser_session.refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=secure,
        samesite="lax",
        path=f"{settings.API_V1_STR}/auth",
        domain=domain,
    )
    response.set_cookie(
        settings.CSRF_COOKIE_NAME,
        browser_session.csrf_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=False,
        secure=secure,
        samesite="lax",
        path="/",
        domain=domain,
    )


def _clear_session_cookies(response: Response) -> None:
    domain = _cookie_domain()
    response.delete_cookie(
        settings.ACCESS_COOKIE_NAME, path=settings.API_V1_STR, domain=domain
    )
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=f"{settings.API_V1_STR}/auth",
        domain=domain,
    )
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/", domain=domain)


def _authenticate_or_reject(
    db: Session, identifier: str, password: str, request: Request
) -> User:
    client_ip = request.client.host if request.client else "unknown"
    try:
        retry_after = session_store.login_retry_after(identifier, client_ip)
    except SessionUnavailable as error:
        raise _session_error(error) from error
    if retry_after > 0:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts",
            headers={"Retry-After": str(retry_after)},
        )
    user = crud_user.authenticate_flexible(
        db, identifier=(identifier or "").strip(), password=password
    )
    if not user:
        # Keep the missing-user path computationally close to a real password check.
        security.verify_password(password or "", _DUMMY_PASSWORD_HASH)
        try:
            delay = session_store.record_login_failure(identifier, client_ip)
        except SessionUnavailable as error:
            raise _session_error(error) from error
        if delay:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts",
                headers={"Retry-After": str(delay)},
            )
        raise HTTPException(status_code=401, detail="Incorrect identifier or password")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Incorrect identifier or password")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Account is banned")
    try:
        session_store.clear_login_failures(identifier, client_ip)
    except SessionUnavailable as error:
        raise _session_error(error) from error
    return user


def _new_browser_session(response: Response, user: User):
    try:
        browser_session = session_store.create(user.id)
    except SessionUnavailable as error:
        raise _session_error(error) from error
    _set_session_cookies(response, browser_session)
    return user


@router.post("/auth/login", response_model=UserSchema)
@limiter.limit("20/minute")
def browser_login(
    request: Request,
    response: Response,
    payload: BrowserLoginRequest,
    db: Session = Depends(deps.get_db),
) -> Any:
    user = _authenticate_or_reject(db, payload.identifier, payload.password, request)
    return _new_browser_session(response, user)


@router.post("/auth/refresh", response_model=UserSchema)
@limiter.limit("30/minute")
def refresh_browser_session(
    request: Request,
    response: Response,
    db: Session = Depends(deps.get_db),
) -> Any:
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME, "")
    try:
        browser_session = session_store.rotate(refresh_token)
    except SessionUnavailable as error:
        raise _session_error(error) from error
    except ValueError as error:
        _clear_session_cookies(response)
        raise HTTPException(status_code=401, detail="Refresh session is invalid") from error
    user = db.get(User, browser_session.user_id)
    if not user or not user.is_active or user.is_banned:
        session_store.revoke(browser_session.sid)
        _clear_session_cookies(response)
        raise HTTPException(status_code=401, detail="Refresh session is invalid")
    _set_session_cookies(response, browser_session)
    return user


@router.post("/auth/logout")
def logout_browser_session(request: Request, response: Response) -> Any:
    sid = ""
    access_token = request.cookies.get(settings.ACCESS_COOKIE_NAME, "")
    if access_token:
        try:
            sid = str(security.decode_access_token(access_token).get("sid") or "")
        except ValueError:
            sid = ""
    if not sid:
        sid = session_store.refresh_sid(
            request.cookies.get(settings.REFRESH_COOKIE_NAME, "")
        )
    if sid:
        try:
            session_store.revoke(sid)
        except SessionUnavailable as error:
            raise _session_error(error) from error
    _clear_session_cookies(response)
    return {"message": "Logged out"}


@router.post("/auth/session/migrate", response_model=UserSchema)
@limiter.limit("10/minute")
def migrate_legacy_session(
    request: Request,
    response: Response,
    db: Session = Depends(deps.get_db),
) -> Any:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Legacy token required")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = security.decode_access_token(token)
        if payload.get("sid"):
            raise ValueError("not a legacy token")
        user_id = int(payload.get("sub"))
        if not session_store.mark_legacy_migrated(
            token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        ):
            raise HTTPException(status_code=409, detail="Legacy token already migrated")
    except SessionUnavailable as error:
        raise _session_error(error) from error
    except (TypeError, ValueError) as error:
        raise HTTPException(status_code=401, detail="Legacy token is invalid") from error
    user = db.get(User, user_id)
    if not user or not user.is_active or user.is_banned:
        raise HTTPException(status_code=401, detail="Legacy token is invalid")
    return _new_browser_session(response, user)


def _send_email_code(email: str, code: str, purpose: str) -> None:
    if settings.SMTP_HOST and settings.SMTP_USERNAME and settings.SMTP_PASSWORD and settings.SMTP_FROM_EMAIL:
        subject = "Amine Web 验证码"
        action_text = "注册" if purpose == "register" else "重置密码"
        body = (
            f"您好，您正在进行{action_text}操作。\n"
            f"验证码：{code}\n"
            f"有效期：{settings.EMAIL_CODE_EXPIRE_MINUTES} 分钟。\n"
            "若非本人操作，请忽略此邮件。"
        )
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = str(settings.SMTP_FROM_EMAIL)
        message["To"] = email
        message.set_content(body)

        try:
            if settings.SMTP_USE_TLS:
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
                    smtp.starttls()
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    smtp.send_message(message)
            else:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    smtp.send_message(message)
            return
        except Exception as e:
            logger.error("邮件发送失败 [%s -> %s]: %s", settings.SMTP_USERNAME, email, e)
            if not settings.EMAIL_CODE_DEBUG:
                raise HTTPException(status_code=503, detail="Email service unavailable")

    # SMTP 未配置
    if not settings.EMAIL_CODE_DEBUG:
        raise HTTPException(status_code=503, detail="Email service unavailable")


def _verify_email_code_or_raise(email: str, purpose: str, code: str) -> str:
    key = _build_code_key(email, purpose)
    result = code_store.verify(key, (code or "").strip(), max_attempts=5)
    if result == "missing":
        raise HTTPException(status_code=400, detail="验证码不存在或已失效")
    if result == "locked":
        raise HTTPException(status_code=400, detail="验证码错误次数过多，已失效")
    if result != "ok":
        raise HTTPException(status_code=400, detail="验证码错误")
    return key


def _build_unique_username(db: Session, email: str) -> str:
    local_part = _normalize_email(email).split("@", 1)[0]
    base = re.sub(r"[^a-zA-Z0-9_.-]", "", local_part)[:24] or "user"
    candidate = base
    index = 1
    while crud_user.get_by_username(db, username=candidate):
        candidate = f"{base}_{index}"
        index += 1
    return candidate

@router.post("/login/access-token", response_model=Token)
@limiter.limit("20/minute")  # 防止暴力破解密码
def login_access_token(
    response: Response,
    request: Request,
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    用OAuth2密码模式登录以获取访问token
    支持邮箱或用户名登录，调用crud_user.authenticate_flexible验证用户凭据
    成功后创建并返回JWT访问token，失败则抛出HTTP 400错误
    """
    user = _authenticate_or_reject(db, form_data.username, form_data.password, request)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            {"sub": str(user.id)}, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }


@router.post("/auth/email-code/send", response_model=EmailCodeSendResponse)
@limiter.limit("5/minute")  # 防止刺刀密码攻击和爆破邮箔
def send_email_code(
    response: Response,
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    req: EmailCodeSendRequest,
) -> Any:
    purpose = _validate_purpose(req.purpose)
    email = _normalize_email(req.email)

    account_exists = crud_user.get_by_email(db, email=email) is not None
    if (purpose == "register" and account_exists) or (
        purpose == "reset_password" and not account_exists
    ):
        # Do not expose account existence through status code or response text.
        return {
            "message": "验证码已发送",
            "expires_in_seconds": settings.EMAIL_CODE_EXPIRE_MINUTES * 60,
            "debug_code": None,
        }

    key = _build_code_key(email, purpose)
    now = _utcnow()

    if not code_store.acquire_send_lock(key, ttl_seconds=30):
        raise HTTPException(status_code=429, detail="验证码正在发送，请稍后重试")

    try:
        previous = code_store.get(key)
        if previous:
            next_send_at_ts = previous.get("next_send_at_ts", 0)
            if next_send_at_ts > now.timestamp():
                remain = int(next_send_at_ts - now.timestamp())
                raise HTTPException(status_code=429, detail=f"发送过于频繁，请 {max(remain, 1)} 秒后重试")

        code = _generate_code()
        expire_minutes = settings.EMAIL_CODE_EXPIRE_MINUTES
        cooldown = settings.EMAIL_CODE_SEND_COOLDOWN_SECONDS
        ttl = max(expire_minutes * 60, cooldown) + 5

        # Only publish the code/cooldown after SMTP accepted the message.
        _send_email_code(email=email, code=code, purpose=purpose)
        code_store.set(key, {
            "code": code,
            "attempts": 0,
            "next_send_at_ts": (now + timedelta(seconds=cooldown)).timestamp(),
        }, ttl_seconds=ttl)
    finally:
        code_store.release_send_lock(key)

    return {
        "message": "验证码已发送",
        "expires_in_seconds": settings.EMAIL_CODE_EXPIRE_MINUTES * 60,
        "debug_code": code if settings.EMAIL_CODE_DEBUG else None,
    }


@router.post("/auth/register-email", response_model=UserSchema)
@limiter.limit("10/minute")
def register_by_email(
    response: Response,
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    req: RegisterByEmailRequest,
) -> Any:
    email = _normalize_email(req.email)
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    _validate_password_strength(req.password)
    code_key = _verify_email_code_or_raise(email=email, purpose="register", code=req.code)

    if crud_user.get_by_email(db, email=email):
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=email,
        username=_build_unique_username(db, email),
        hashed_password=security.get_password_hash(req.password),
        is_superuser=False,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email or username already exists") from error
    code_store.delete(code_key)
    return user


@router.post("/auth/password-reset")
@limiter.limit("10/minute")
def reset_password_by_email_code(
    response: Response,
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    req: PasswordResetByCodeRequest,
) -> Any:
    email = _normalize_email(req.email)
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    _validate_password_strength(req.password)
    code_key = _verify_email_code_or_raise(email=email, purpose="reset_password", code=req.code)

    user = crud_user.get_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="该邮箱尚未注册")

    try:
        session_store.ping()
    except SessionUnavailable as error:
        raise _session_error(error) from error
    user.hashed_password = security.get_password_hash(req.password)
    db.add(user)
    db.commit()
    try:
        session_store.revoke_all(user.id)
    except SessionUnavailable as error:
        raise _session_error(error) from error
    code_store.delete(code_key)

    return {"message": "密码已重置，请使用新密码登录"}
