"""User and role models for the four platform personas."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    LENDER = "LENDER"           # Bank / NBFC / Dealer
    MSME = "MSME"               # Business owner viewing own report
    GOVERNMENT = "GOVERNMENT"   # Ecosystem / regulator analytics
    ADMIN = "ADMIN"             # Platform admin


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.LENDER, index=True)
    org_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Optional MSME binding (only for UserRole.MSME)
    msme_id: Mapped[int | None] = mapped_column(nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    is_active: Mapped[bool] = mapped_column(default=True)
