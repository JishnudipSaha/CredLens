"""SQLAlchemy engine, session factory, and Base."""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from app.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Session:
    """FastAPI dependency: yield a database session and close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_sqlite_columns() -> None:
    """Idempotent ALTERs for columns added after a table was first created.

    SQLAlchemy's create_all never alters existing tables, so SQLite dev
    databases created before these columns existed would miss them.
    Called from both the FastAPI lifespan and seed_all.
    """
    from sqlalchemy import inspect, text

    if not settings.database_url.startswith("sqlite"):
        return
    insp = inspect(engine)
    if "policies" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("policies")}
    with engine.begin() as conn:
        if "auto_approve_score" not in cols:
            conn.execute(text("ALTER TABLE policies ADD COLUMN auto_approve_score INTEGER DEFAULT 700"))
        if "review_min_score" not in cols:
            conn.execute(text("ALTER TABLE policies ADD COLUMN review_min_score INTEGER DEFAULT 600"))
