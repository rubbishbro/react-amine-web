from pydantic import BaseModel, ConfigDict, EmailStr, Field


class BrowserLoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    model_config = ConfigDict(extra="forbid")


class EmailCodeSendRequest(BaseModel):
    email: EmailStr
    purpose: str


class EmailCodeSendResponse(BaseModel):
    message: str
    expires_in_seconds: int
    debug_code: str | None = None


class RegisterByEmailRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class PasswordResetByCodeRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
