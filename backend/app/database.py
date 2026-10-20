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
    tables = insp.get_table_names()
    with engine.begin() as conn:
        if "policies" in tables:
            p_cols = {c["name"] for c in insp.get_columns("policies")}
            if "auto_approve_score" not in p_cols:
                conn.execute(text("ALTER TABLE policies ADD COLUMN auto_approve_score INTEGER DEFAULT 700"))
            if "review_min_score" not in p_cols:
                conn.execute(text("ALTER TABLE policies ADD COLUMN review_min_score INTEGER DEFAULT 600"))

        if "msme_financials" in tables:
            f_cols = {c["name"] for c in insp.get_columns("msme_financials")}
            new_f_cols = [
                ("dscr", "FLOAT DEFAULT 1.5"),
                ("interest_coverage_ratio", "FLOAT DEFAULT 3.0"),
                ("current_ratio", "FLOAT DEFAULT 1.33"),
                ("gst_vs_bank_turnover_variance_pct", "FLOAT DEFAULT 0.0"),
                ("cibil_cmr_rank", "INTEGER DEFAULT 3"),
                ("max_dpd_12m", "INTEGER DEFAULT 0"),
                ("active_credit_facilities", "INTEGER DEFAULT 2"),
                ("cash_withdrawal_ratio", "FLOAT DEFAULT 0.05"),
                ("data_trust_score", "FLOAT DEFAULT 85.0"),
                ("verification_badges", "JSON DEFAULT '[]'"),
            ]
            for col_name, col_def in new_f_cols:
                if col_name not in f_cols:
                    conn.execute(text(f"ALTER TABLE msme_financials ADD COLUMN {col_name} {col_def}"))

        if "decisions" in tables:
            d_cols = {c["name"] for c in insp.get_columns("decisions")}
            new_d_cols = [
                ("covenants", "JSON DEFAULT '[]'"),
                ("working_capital_mpbf_inr", "FLOAT DEFAULT 0.0"),
                ("term_loan_limit_inr", "FLOAT DEFAULT 0.0"),
                ("underwriting_summary", "JSON DEFAULT '{}'"),
            ]
            for col_name, col_def in new_d_cols:
                if col_name not in d_cols:
                    conn.execute(text(f"ALTER TABLE decisions ADD COLUMN {col_name} {col_def}"))
