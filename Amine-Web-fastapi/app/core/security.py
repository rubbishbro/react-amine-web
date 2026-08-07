"""Password hashing and JWT helpers."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


_bcrypt_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_argon2 = PasswordHasher(time_cost=2, memory_cost=19 * 1024, parallelism=1)


def is_legacy_password_hash(hashed_password: str) -> bool:
    return not (hashed_password or "").startswith("$argon2")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    if is_legacy_password_hash(hashed_password):
        try:
            # Preserve compatibility with passwords created by the old code.
            return _bcrypt_context.verify(plain_password[:72], hashed_password)
        except (ValueError, TypeError):
            return False
    try:
        return _argon2.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_hash_needs_upgrade(hashed_password: str) -> bool:
    if is_legacy_password_hash(hashed_password):
        return True
    try:
        return _argon2.check_needs_rehash(hashed_password)
    except InvalidHashError:
        return True


def get_password_hash(password: str) -> str:
    if not 8 <= len(password or "") <= 128:
        raise ValueError("password must be between 8 and 128 characters")
    return _argon2.hash(password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
    *,
    session_id: Optional[str] = None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    claims = {
        **data,
        "exp": expire,
        "iat": now,
        "jti": uuid4().hex,
    }
    if session_id:
        claims.update(
            {
                "sid": session_id,
                "iss": settings.JWT_ISSUER,
                "aud": settings.JWT_AUDIENCE,
                "token_kind": "access",
            }
        )
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str, *, require_session: bool = False) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False},
        )
    except JWTError as error:
        raise ValueError("invalid access token") from error

    sid = payload.get("sid")
    if require_session and not sid:
        raise ValueError("session token required")
    if sid:
        if payload.get("iss") != settings.JWT_ISSUER:
            raise ValueError("invalid token issuer")
        audience = payload.get("aud")
        valid_audience = (
            settings.JWT_AUDIENCE in audience
            if isinstance(audience, list)
            else audience == settings.JWT_AUDIENCE
        )
        if not valid_audience or payload.get("token_kind") != "access":
            raise ValueError("invalid token audience")
    return payload
