"""Auth request/response schemas."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = UserRole.LENDER
    org_name: str | None = None
    msme_id: int | None = None  # only for MSME role


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: int
    name: str
    email: EmailStr


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: UserRole
    org_name: str | None
    msme_id: int | None
    is_active: bool

    class Config:
        from_attributes = True
