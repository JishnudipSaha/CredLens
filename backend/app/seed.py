"""Database seed - runs on first launch to populate demo data and train the model."""
from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta
from pathlib import Path

from faker import Faker
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models.msme import MSME, MSMEFinancials
from app.models.policy import Policy
from app.models.user import User, UserRole
from app.services.ingestion_service import derive_financials
from app.services.orchestrator import run_assessment

log = logging.getLogger(__name__)
fake = Faker("en_IN")
Faker.seed(42)
random.seed(42)


SECTORS = ["manufacturing", "retail", "services", "it", "other"]
STATES = ["Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Delhi", "Telangana", "Uttar Pradesh", "West Bengal"]
CITIES = ["Mumbai", "Bengaluru", "Chennai", "Ahmedabad", "New Delhi", "Hyderabad", "Pune", "Kolkata"]


def _ensure_schema() -> None:
    Base.metadata.create_all(engine)


def _ensure_model() -> None:
    if settings.model_path.exists():
        return
    log.info("ML model not found - training synthetic model first...")
    from app.ml import train_synthetic
    train_synthetic.train_and_save()


def _seed_users(db: Session) -> dict[str, User]:
    users: dict[str, User] = {}
    accounts = [
        ("lender@credlens.in", "Lender Demo", "lender123", UserRole.LENDER, "Demo Bank Ltd"),
        ("msme@credlens.in", "Acme Textiles Owner", "msme123", UserRole.MSME, None),
        ("govt@credlens.in", "Government Analyst", "govt123", UserRole.GOVERNMENT, "Ministry of MSME"),
        ("admin@credlens.in", "Platform Admin", "admin123", UserRole.ADMIN, "CredLens Platform"),
    ]
    for email, name, pw, role, org in accounts:
        u = db.query(User).filter(User.email == email).first()
        if u:
            users[email] = u
            continue
        u = User(
            email=email, name=name, hashed_password=hash_password(pw),
            role=role, org_name=org, is_active=True,
        )
        db.add(u)
        db.flush()
        users[email] = u
    return users


def _seed_policy(db: Session) -> Policy:
    p = db.query(Policy).filter(Policy.is_active.is_(True)).first()
    if p:
        return p
    p = Policy(
        name="Default Bank Policy",
        description="Baseline credit policy applied to all lenders by default.",
        is_active=True,
    )
    db.add(p)
    db.flush()
    return p


def _gstin() -> str:
    s = "".join(random.choices("0123456789", k=2))
    s += "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=5))
    s += "".join(random.choices("0123456789", k=4))
    s += random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    s += random.choice("123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    s += "Z"
    s += random.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return s


def _pan() -> str:
    s = "".join(random.choices("ABCDEFGHIJKLMNOPQRSTUVWXYZ", k=5))
    s += "".join(random.choices("0123456789", k=4))
    s += random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return s


def _udyam() -> str:
    return "UDYAM-" + "-".join(
        "".join(random.choices("0123456789", k=k)) for k in (2, 6, 2, 4)
    )


def _gen_msme_record(idx: int) -> dict:
    sector = random.choice(SECTORS)
    state = random.choice(STATES)
    city = random.choice(CITIES)
    profile = {
        "legal_name": f"{fake.company()} {sector.title()} Pvt Ltd",
        "trade_name": fake.company_suffix(),
        "gstin": _gstin(),
        "pan": _pan(),
        "udyam_number": _udyam(),
        "sector": sector,
        "sub_sector": fake.bs().title(),
        "state": state,
        "city": city,
        "incorporation_date": fake.date_time_between(start_date="-15y", end_date="-1y"),
        "employee_count": random.randint(5, 250),
    }
    # Healthy vs risky profile
    risky = random.random() < 0.30
    avg_rev = random.uniform(200_000, 8_000_000) if not risky else random.uniform(50_000, 1_500_000)
    filings_expected = 6
    filings_done = (3 if risky and random.random() < 0.5 else 6) if not risky else random.randint(2, 5)
    trend = random.uniform(-5, 25) if not risky else random.uniform(-40, 5)
    ebitda = random.uniform(8, 25) if not risky else random.uniform(-5, 12)
    bounced = 0 if not risky else random.choice([0, 1, 2, 4])
    util = round(random.uniform(0.9, 1.0), 2) if not risky else round(random.uniform(0.5, 0.85), 2)
    concentration = round(random.uniform(0.2, 0.5), 2) if not risky else round(random.uniform(0.55, 0.85), 2)
    debt = avg_rev * 12 * random.uniform(0.05, 0.25) if not risky else avg_rev * 12 * random.uniform(0.3, 0.8)
    balance = avg_rev * random.uniform(0.1, 0.5) if not risky else avg_rev * random.uniform(0.01, 0.08)

    # Raw payloads (simulate what ingestion would have produced)
    gst_returns = []
    for m in range(filings_expected):
        gst_returns.append({
            "period": (datetime(2025, 1, 1) + timedelta(days=30 * m)).strftime("%Y-%m"),
            "taxable_value": round(avg_rev * (1 + trend / 100) ** (m / 6), 2),
            "tax_paid": round(avg_rev * 0.18 * (1 + trend / 100) ** (m / 6), 2),
        })
    bank_stmts = []
    for m in range(6):
        bank_stmts.append({
            "month": (datetime(2025, 1, 1) + timedelta(days=30 * m)).strftime("%Y-%m"),
            "closing_balance": round(balance * (0.9 + 0.05 * m), 2),
            "bounced_cheques": bounced if m == 5 else 0,
        })
    return {
        **profile,
        "annual_turnover_inr": round(avg_rev * 12, 2),
        "raw_financial": {
            "bank_statements": bank_stmts,
            "gst_returns": gst_returns,
            "itr_filings": [
                {"assessment_year": str(2022 + y), "total_income": round(avg_rev * 12 * (0.9 + 0.05 * y), 2)}
                for y in range(3)
            ],
            "balance_sheet": {
                "revenue": round(avg_rev * 12, 2),
                "ebitda": round(avg_rev * 12 * ebitda / 100, 2),
                "existing_loan_obligations_annual": round(debt, 2),
            },
        },
        "raw_business": {
            "invoices": [
                {"invoice_number": f"INV{1000 + i}", "amount": round(avg_rev * 0.1, 2), "date": fake.date_between("-6M", "today").isoformat()}
                for i in range(5)
            ],
            "purchase_orders": [],
            "bills": [],
        },
        "raw_alternative": {
            "utility_payments": [
                {"month": (datetime(2025, 1, 1) + timedelta(days=30 * m)).strftime("%Y-%m"),
                 "on_time": random.random() < util}
                for m in range(6)
            ],
            "telecom_data": {"score": round(random.uniform(0.5, 0.9), 2)},
            "digital_footprint": {"score": round(random.uniform(0.4, 0.8), 2)},
        },
        "raw_government": {
            "mca_data": {"cin": f"U{''.join(random.choices('0123456789', k=20))}"},
            "gstin_data": {"status": "Active"},
            "udyam_data": {"enterprise_type": random.choice(["Micro", "Small", "Medium"])},
            "cibil_score": random.randint(680, 820) if not risky else random.randint(520, 680),
            "cibil_accounts": [
                {"outstanding": round(avg_rev * random.uniform(0.05, 0.3), 2)}
                for _ in range(3)
            ],
        },
        "_financials_kwargs": {
            "avg_monthly_revenue_inr": round(avg_rev, 2),
            "revenue_trend_pct": round(trend, 2),
            "ebitda_margin_pct": round(ebitda, 2),
            "gst_filings_expected": filings_expected,
            "gst_filings_done": filings_done,
            "gst_compliance_ratio": round(filings_done / filings_expected, 4),
            "avg_bank_balance_inr": round(balance, 2),
            "bounced_cheques_12m": bounced,
            "existing_loan_obligations_inr": round(debt, 2),
            "utility_payment_consistency": util,
            "telecom_footprint_score": round(random.uniform(0.5, 0.9), 2),
            "digital_footprint_score": round(random.uniform(0.4, 0.8), 2),
            "top_customer_concentration_pct": concentration,
        },
    }


def _seed_msmes(db: Session, msme_user: User, count: int = 50) -> list[MSME]:
    existing = db.query(MSME).count()
    if existing >= count:
        msmes = db.query(MSME).order_by(MSME.id).limit(20).all()
        return msmes

    created: list[MSME] = []
    for i in range(count):
        record = _gen_msme_record(i)
        kwargs = record.pop("_financials_kwargs")
        m = MSME(**record)
        db.add(m)
        db.flush()
        fin = MSMEFinancials(msme_id=m.id, **kwargs)
        fin.vintage_years = round(
            (datetime.utcnow() - m.incorporation_date).days / 365.25, 2
        ) if m.incorporation_date else 0.0
        db.add(fin)
        created.append(m)
    db.flush()

    # Bind the first MSME to the demo MSME user
    if created:
        msme_user.msme_id = created[0].id
        db.flush()

    return created


def seed_all(force: bool = False) -> dict:
    _ensure_schema()
    _ensure_model()

    db = SessionLocal()
    try:
        if not force and db.query(User).count() > 0:
            log.info("Seed skipped - data already exists.")
            return {"status": "skipped"}

        log.info("Seeding demo data...")
        users = _seed_users(db)
        policy = _seed_policy(db)
        msmes = _seed_msmes(db, users["msme@credlens.in"], count=50)

        # Run an initial assessment for the first 20 MSMEs so dashboards have data
        lender = users["lender@credlens.in"]
        assessments = 0
        for m in msmes[:20]:
            try:
                run_assessment(db, m, triggered_by_user_id=lender.id)
                assessments += 1
            except Exception as exc:
                log.warning("Initial assessment failed for MSME %s: %s", m.id, exc)

        db.commit()
        log.info("Seed complete: %d users, %d MSMEs, %d initial assessments.",
                 len(users), len(msmes), assessments)
        return {
            "status": "ok",
            "users": len(users),
            "msmes": len(msmes),
            "assessments": assessments,
        }
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    print(seed_all(force=True))
