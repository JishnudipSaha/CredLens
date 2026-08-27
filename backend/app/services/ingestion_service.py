"""
Layer 1 - Data Ingestion Service.
Implements: parse -> clean -> validate -> dedup -> persist.
Each public function ingests a data type and returns an IngestResult.
"""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction, AuditLog
from app.models.msme import MSME, MSMEFinancials
from app.schemas.msme import (
    AlternativeIngest,
    BusinessIngest,
    FinancialIngest,
    GovernmentIngest,
    IngestResult,
    ManualIngest,
)


# ---------- cleaning helpers ----------

def _clean_money(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = re.sub(r"[^0-9.\-]", "", str(value))
    try:
        return float(s)
    except ValueError:
        return 0.0


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    return str(value).strip() or None


def _dedup_by_key(records: list[dict], key_fn) -> list[dict]:
    seen: set = set()
    out: list[dict] = []
    for r in records:
        k = key_fn(r)
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out


# ---------- generic ingest pipeline ----------

def _ingest_payload(
    db: Session,
    msme: MSME,
    field_name: str,
    payload: dict,
    validator,
) -> IngestResult:
    """Apply validation to each record, then merge the cleaned payload into MSME.raw_*."""
    errors: list[str] = []
    accepted = 0
    rejected = 0

    if not payload:
        return IngestResult(msme_id=msme.id, data_type=field_name,
                            accepted_records=0, rejected_records=0, validation_errors=[])

    for key, value in payload.items():
        if isinstance(value, list):
            for i, rec in enumerate(value):
                if not isinstance(rec, dict):
                    errors.append(f"{key}[{i}]: not an object")
                    rejected += 1
                    continue
                errs = validator(key, rec)
                if errs:
                    errors.extend([f"{key}[{i}]: {e}" for e in errs])
                    rejected += 1
                else:
                    accepted += 1
        elif isinstance(value, dict):
            errs = validator(key, value)
            if errs:
                errors.extend([f"{key}: {e}" for e in errs])
                rejected += 1
            else:
                accepted += 1
        elif value is None:
            continue
        else:
            accepted += 1

    # Persist on the MSME row (shallow merge into the raw_* JSON column)
    existing = getattr(msme, field_name) or {}
    existing.update(payload)
    setattr(msme, field_name, existing)
    db.add(msme)
    db.flush()

    AuditLog.log(db, action=AuditAction.INGEST, msme_id=msme.id,
                 details={"field": field_name, "accepted": accepted, "rejected": rejected})

    return IngestResult(
        msme_id=msme.id,
        data_type=field_name,
        accepted_records=accepted,
        rejected_records=rejected,
        validation_errors=errors[:50],
    )


# ---------- validators per data type ----------

def _validate_financial(key: str, rec: dict) -> list[str]:
    errs: list[str] = []
    if key == "bank_statements":
        if "month" not in rec:
            errs.append("missing 'month'")
        if "closing_balance" in rec:
            try:
                float(rec["closing_balance"])
            except (TypeError, ValueError):
                errs.append("closing_balance not numeric")
    elif key == "gst_returns":
        for required in ("period", "taxable_value", "tax_paid"):
            if required not in rec:
                errs.append(f"missing '{required}'")
                break
    elif key == "itr_filings":
        if "assessment_year" not in rec:
            errs.append("missing assessment_year")
    return errs


def _validate_business(key: str, rec: dict) -> list[str]:
    errs: list[str] = []
    if key in ("invoices", "purchase_orders", "bills"):
        for f in ("invoice_number", "amount", "date"):
            if f not in rec:
                errs.append(f"missing '{f}'")
                break
    return errs


def _validate_alternative(key: str, rec: dict) -> list[str]:
    errs: list[str] = []
    if key == "utility_payments":
        if "on_time" not in rec:
            errs.append("missing 'on_time'")
    return errs


def _validate_government(key: str, rec: dict) -> list[str]:
    return []  # government pulls are usually trusted


def _validate_manual(key: str, rec: dict) -> list[str]:
    return []


# ---------- per-data-type ingest entry points ----------

def ingest_financial(db: Session, msme: MSME, payload: FinancialIngest) -> IngestResult:
    data: dict[str, Any] = {
        "bank_statements": _dedup_by_key(payload.bank_statements, lambda r: r.get("month", "")),
        "gst_returns": _dedup_by_key(payload.gst_returns, lambda r: r.get("period", "")),
        "itr_filings": _dedup_by_key(payload.itr_filings, lambda r: r.get("assessment_year", "")),
        "balance_sheet": payload.balance_sheet,
    }
    return _ingest_payload(db, msme, "raw_financial", data, _validate_financial)


def ingest_business(db: Session, msme: MSME, payload: BusinessIngest) -> IngestResult:
    data = {
        "invoices": _dedup_by_key(payload.invoices, lambda r: r.get("invoice_number", "")),
        "purchase_orders": _dedup_by_key(payload.purchase_orders, lambda r: r.get("po_number", r.get("invoice_number", ""))),
        "bills": _dedup_by_key(payload.bills, lambda r: r.get("bill_number", r.get("invoice_number", ""))),
    }
    return _ingest_payload(db, msme, "raw_business", data, _validate_business)


def ingest_alternative(db: Session, msme: MSME, payload: AlternativeIngest) -> IngestResult:
    data = {
        "utility_payments": payload.utility_payments,
        "telecom_data": payload.telecom_data,
        "digital_footprint": payload.digital_footprint,
    }
    return _ingest_payload(db, msme, "raw_alternative", data, _validate_alternative)


def ingest_government(db: Session, msme: MSME, payload: GovernmentIngest) -> IngestResult:
    data = {
        "mca_data": payload.mca_data,
        "gstin_data": payload.gstin_data,
        "udyam_data": payload.udyam_data,
        "cibil_score": payload.cibil_score,
        "cibil_accounts": payload.cibil_accounts,
    }
    return _ingest_payload(db, msme, "raw_government", data, _validate_government)


def ingest_manual(db: Session, msme: MSME, payload: ManualIngest) -> IngestResult:
    data = {"notes": payload.notes, "documents": payload.documents}
    return _ingest_payload(db, msme, "raw_manual", data, _validate_manual)


# ---------- derive financials from raw data ----------

def derive_financials(db: Session, msme: MSME) -> MSMEFinancials:
    """Recompute the MSMEFinancials snapshot from raw ingested data.

    This is the bridge from Layer 1 to Layer 2.
    """
    fin: MSMEFinancials = msme.financials or MSMEFinancials(msme_id=msme.id)
    if not fin.msme_id:
        fin.msme_id = msme.id

    # --- Revenue & GST from financial data ---
    gst_returns = (msme.raw_financial or {}).get("gst_returns", []) or []
    bank_stmts = (msme.raw_financial or {}).get("bank_statements", []) or []
    balance_sheet = (msme.raw_financial or {}).get("balance_sheet", {}) or {}

    taxable_values = [_clean_money(r.get("taxable_value")) for r in gst_returns]
    if taxable_values:
        # Treat each GST return as roughly one period (month or quarter)
        # Normalise: if 6 values, treat as 6 months; if 4, as 4 quarters -> expand to monthly
        n = len(taxable_values)
        if n == 4:
            monthly = [v / 3.0 for v in taxable_values]
        else:
            monthly = taxable_values
        fin.avg_monthly_revenue_inr = round(sum(monthly) / len(monthly), 2) if monthly else 0.0
        # Trend: last vs first
        if len(monthly) >= 2 and monthly[0] > 0:
            fin.revenue_trend_pct = round(((monthly[-1] - monthly[0]) / monthly[0]) * 100, 2)
        fin.gst_filings_expected = n
        fin.gst_filings_done = n
        fin.gst_compliance_ratio = round(n / n, 4) if n else 0.0

    # --- Bank statements ---
    balances = [_clean_money(b.get("closing_balance")) for b in bank_stmts]
    if balances:
        fin.avg_bank_balance_inr = round(sum(balances) / len(balances), 2)
        # Bounced cheques: explicit field if provided
        fin.bounced_cheques_12m = sum(int(b.get("bounced_cheques", 0) or 0) for b in bank_stmts)

    # --- Balance sheet ---
    if balance_sheet:
        revenue_ytd = _clean_money(balance_sheet.get("revenue"))
        ebitda = _clean_money(balance_sheet.get("ebitda"))
        if revenue_ytd > 0 and ebitda:
            fin.ebitda_margin_pct = round((ebitda / revenue_ytd) * 100, 2)
        obligations = _clean_money(balance_sheet.get("existing_loan_obligations_annual"))
        if obligations:
            fin.existing_loan_obligations_inr = obligations

    # --- Alternative data ---
    alt = msme.raw_alternative or {}
    util = alt.get("utility_payments", []) or []
    if util:
        on_time = sum(1 for u in util if u.get("on_time"))
        fin.utility_payment_consistency = round(on_time / len(util), 4)
    telecom = alt.get("telecom_data") or {}
    if "score" in telecom:
        fin.telecom_footprint_score = max(0.0, min(1.0, float(telecom["score"])))
    digital = alt.get("digital_footprint") or {}
    if "score" in digital:
        fin.digital_footprint_score = max(0.0, min(1.0, float(digital["score"])))

    # --- Government data: CIBIL accounts, concentration ---
    gov = msme.raw_government or {}
    if gov.get("cibil_score"):
        # Map external bureau score into our range indirectly via utilisation later;
        # we keep financials free of bureau influence - the model will use it.
        pass
    accounts = gov.get("cibil_accounts", []) or []
    if accounts:
        # Customer concentration: largest outstanding balance vs total
        outstandings = [_clean_money(a.get("outstanding")) for a in accounts]
        if outstandings and sum(outstandings) > 0:
            fin.top_customer_concentration_pct = round(
                max(outstandings) / sum(outstandings), 4
            )

    # --- Vintage ---
    if msme.incorporation_date:
        delta = (msme.updated_at or msme.created_at) - msme.incorporation_date
        fin.vintage_years = round(max(delta.days, 0) / 365.25, 2)

    db.add(fin)
    db.flush()
    return fin
