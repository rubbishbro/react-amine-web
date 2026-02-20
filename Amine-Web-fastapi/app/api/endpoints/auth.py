# 登录换token的API端点
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
import re
import secrets
import smtplib
from typing import Any

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.crud import crud_user
from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.code_store import code_store
from app.core.limiter import limiter
from app.models.user import User

logger = logging.getLogger(__name__)
from app.schemas.auth import (
    EmailCodeSendRequest,
    EmailCodeSendResponse,
    PasswordResetByCodeRequest,
    RegisterByEmailRequest,
)
from app.schemas.token import Token
from app.schemas.user import User as UserSchema

router = APIRouter()

_PASSWORD_PATTERN = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")


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
            # 邮件发送失败，记录错误但不抛出异常
            # 在生产环境中，可以考虑记录到日志系统
            logger.error("邮件发送失败 [%s -> %s]: %s", settings.SMTP_USERNAME, email, e)
            # 如果是调试模式，继续；否则抛出异常
            if not settings.EMAIL_CODE_DEBUG:
                raise HTTPException(status_code=500, detail=f"邮件发送失败: {str(e)}")

    # SMTP 未配置
    if not settings.EMAIL_CODE_DEBUG:
        raise HTTPException(status_code=500, detail="邮件服务未配置，无法发送验证码")


def _verify_email_code_or_raise(email: str, purpose: str, code: str) -> None:
    key = _build_code_key(email, purpose)
    payload = code_store.get(key)
    if not payload:
        raise HTTPException(status_code=400, detail="验证码不存在或已失效")
    if payload.get("code") != (code or "").strip():
        raise HTTPException(status_code=400, detail="验证码错误")
    code_store.delete(key)


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
    request: Request,
    db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    用OAuth2密码模式登录以获取访问token
    支持邮箱或用户名登录，调用crud_user.authenticate_flexible验证用户凭据
    成功后创建并返回JWT访问token，失败则抛出HTTP 400错误
    """
    user = crud_user.authenticate_flexible(
        db, identifier=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email/username or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
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
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    req: EmailCodeSendRequest,
) -> Any:
    purpose = _validate_purpose(req.purpose)
    email = _normalize_email(req.email)

    if purpose == "register" and crud_user.get_by_email(db, email=email):
        raise HTTPException(status_code=400, detail="该邮箱已被注册")
    if purpose == "reset_password" and not crud_user.get_by_email(db, email=email):
        raise HTTPException(status_code=404, detail="该邮箱尚未注册")

    key = _build_code_key(email, purpose)
    now = _utcnow()

    # 冷却检查：读取现有记录
    previous = code_store.get(key)
    if previous:
        next_send_at_ts = previous.get("next_send_at_ts", 0)
        if next_send_at_ts > now.timestamp():
            remain = int(next_send_at_ts - now.timestamp())
            raise HTTPException(status_code=429, detail=f"发送过于频繁，请 {max(remain, 1)} 秒后重试")

    code = _generate_code()
    expire_minutes = settings.EMAIL_CODE_EXPIRE_MINUTES
    cooldown = settings.EMAIL_CODE_SEND_COOLDOWN_SECONDS
    ttl = max(expire_minutes * 60, cooldown) + 5  # Redis TTL 取两者较大值再加一点缓冲
    code_store.set(key, {
        "code": code,
        "next_send_at_ts": (now + timedelta(seconds=cooldown)).timestamp(),
    }, ttl_seconds=ttl)

    try:
        _send_email_code(email=email, code=code, purpose=purpose)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"验证码发送失败: {error}")

    return {
        "message": "验证码已发送",
        "expires_in_seconds": settings.EMAIL_CODE_EXPIRE_MINUTES * 60,
        "debug_code": code if settings.EMAIL_CODE_DEBUG else None,
    }


@router.post("/auth/register-email", response_model=UserSchema)
@limiter.limit("10/minute")
def register_by_email(
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    req: RegisterByEmailRequest,
) -> Any:
    email = _normalize_email(req.email)
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    _validate_password_strength(req.password)
    _verify_email_code_or_raise(email=email, purpose="register", code=req.code)

    if crud_user.get_by_email(db, email=email):
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    user = User(
        email=email,
        username=_build_unique_username(db, email),
        hashed_password=security.get_password_hash(req.password),
        is_superuser=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/password-reset")
@limiter.limit("10/minute")
def reset_password_by_email_code(
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    req: PasswordResetByCodeRequest,
) -> Any:
    email = _normalize_email(req.email)
    if req.password != req.confirm_password:
        raise HTTPException(status_code=400, detail="两次输入的密码不一致")
    _validate_password_strength(req.password)
    _verify_email_code_or_raise(email=email, purpose="reset_password", code=req.code)

    user = crud_user.get_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="该邮箱尚未注册")

    user.hashed_password = security.get_password_hash(req.password)
    db.add(user)
    db.commit()

    return {"message": "密码已重置，请使用新密码登录"}
