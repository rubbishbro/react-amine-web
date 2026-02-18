from pydantic import BaseModel, EmailStr


class EmailCodeSendRequest(BaseModel):
    email: EmailStr
    purpose: str


class EmailCodeSendResponse(BaseModel):
    message: str
    expires_in_seconds: int
    debug_code: str | None = None


class RegisterByEmailRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    code: str


class PasswordResetByCodeRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    code: str
