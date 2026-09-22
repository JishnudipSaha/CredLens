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


# Natural identity keys for list-valued raw fields, used when merging
# an incoming payload with what is already stored (incremental ingest).
_LIST_MERGE_KEYS: dict[str, Any] = {
    "bank_statements": lambda r: r.get("month", ""),
    "gst_returns": lambda r: r.get("period", ""),
    "itr_filings": lambda r: r.get("assessment_year", ""),
    "invoices": lambda r: r.get("invoice_number", ""),
    "purchase_orders": lambda r: r.get("po_number", r.get("invoice_number", "")),
    "bills": lambda r: r.get("bill_number", r.get("invoice_number", "")),
    "utility_payments": lambda r: r.get("month", ""),
}


def _merge_record_lists(field: str, existing: list, incoming: list) -> list:
    """Merge two record lists for the same raw_* field without losing data.

    Records sharing a natural key (month / period / invoice_number / ...) are
    replaced by the incoming version (latest data wins); new keys are appended
    in order. Fields without a registered key fall back to value-equality
    append so nothing is silently dropped.
    """
    if not isinstance(existing, list):
        return incoming
    key_fn = _LIST_MERGE_KEYS.get(field)
    if key_fn is None:
        out = list(existing)
        for rec in incoming:
            if rec not in out:
                out.append(rec)
        return out

    order: list = []
    merged: dict = {}
    for rec in list(existing) + list(incoming):
        k = key_fn(rec) if isinstance(rec, dict) else ("__raw__", id(rec))
        if k not in merged:
            order.append(k)
        merged[k] = rec  # incoming wins on key collision
    return [merged[k] for k in order]


# ---------- generic ingest pipeline ----------

def _ingest_payload(
    db: Session,
    msme: MSME,
    field_name: str,
    payload: dict,
    validator,
) -> IngestResult:
    """Validate each record, keep only accepted ones, deep-merge into MSME.raw_*."""
    errors: list[str] = []
    accepted_payload: dict = {}
    accepted = 0
    rejected = 0

    if not payload:
        return IngestResult(msme_id=msme.id, data_type=field_name,
                            accepted_records=0, rejected_records=0, validation_errors=[])

    for key, value in payload.items():
        if isinstance(value, list):
            kept: list[dict] = []
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
                    kept.append(rec)
            if kept:
                accepted_payload[key] = kept
        elif isinstance(value, dict):
            errs = validator(key, value)
            if errs:
                errors.extend([f"{key}: {e}" for e in errs])
                rejected += 1
            else:
                accepted += 1
                accepted_payload[key] = value
        elif value is None:
            continue
        else:
            accepted += 1
            accepted_payload[key] = value

    # Persist only accepted records, deep-merging lists so incremental
    # ingestion appends/replaces records instead of wiping prior data.
    existing = getattr(msme, field_name) or {}
    merged = dict(existing)
    for key, value in accepted_payload.items():
        if key in merged and isinstance(merged[key], list) and isinstance(value, list):
            merged[key] = _merge_record_lists(key, merged[key], value)
        else:
            merged[key] = value
    setattr(msme, field_name, merged)
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
        "utility_payments": _dedup_by_key(payload.utility_payments, lambda r: r.get("month", "")),
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

def _period_to_month_index(period: Any) -> int | None:
    """Parse 'YYYY-MM' into a monotonic month index; None if unparseable."""
    m = re.match(r"^(\d{4})-(\d{1,2})$", str(period or "").strip())
    if not m:
        return None
    year, month = int(m.group(1)), int(m.group(2))
    if not 1 <= month <= 12:
        return None
    return year * 12 + (month - 1)


def _gst_compliance(gst_returns: list[dict]) -> tuple[int, int, float]:
    """Compute (expected, done, ratio) from GST returns.

    Expected = calendar months spanned from first to last filing period
    (a filing gap in the middle means a missed return). Done = distinct
    periods actually filed. Falls back to n/n when periods are unparseable.
    """
    idxs = [_period_to_month_index(r.get("period")) for r in gst_returns]
    if not idxs or any(i is None for i in idxs):
        n = len(gst_returns)
        return n, n, (1.0 if n else 0.0)
    span = max(idxs) - min(idxs) + 1
    done = len(set(idxs))
    expected = max(span, done)
    return expected, done, round(min(done / expected, 1.0), 4)


def derive_financials(db: Session, msme: MSME) -> MSMEFinancials:
    """Recompute the MSMEFinancials snapshot from raw ingested data.

    This is the bridge from Layer 1 to Layer 2.
    """
    fin: MSMEFinancials = msme.financials
    if fin is None:
        fin = MSMEFinancials()
        # Link both sides now so msme.financials is usable immediately
        # (otherwise the relationship stays cached as None until a refresh).
        msme.financials = fin
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
        # Compliance: expected = calendar span of filing periods, done = periods filed.
        # Missing interior periods (filing gaps) now lower the ratio below 1.0.
        expected, done, ratio = _gst_compliance(gst_returns)
        fin.gst_filings_expected = expected
        fin.gst_filings_done = done
        fin.gst_compliance_ratio = ratio

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

    # --- Government data ---
    gov = msme.raw_government or {}
    if gov.get("cibil_score"):
        # Map external bureau score into our range indirectly via utilisation later;
        # we keep financials free of bureau influence - the model will use it.
        pass
    # NOTE: top_customer_concentration_pct is deliberately NOT derived from
    # cibil_accounts - those are lender outstandings, not customer revenue.
    # It is derived from invoices below (customer-attributed amounts only).

    # --- Customer concentration from invoices (customer_id-attributed) ---
    invoices = (msme.raw_business or {}).get("invoices", []) or []
    amounts_by_customer: dict[str, float] = {}
    for inv in invoices:
        if not isinstance(inv, dict):
            continue
        cid = inv.get("customer_id")
        if cid is None:
            continue  # cannot attribute - leave any existing value untouched
        amounts_by_customer[str(cid)] = amounts_by_customer.get(str(cid), 0.0) + _clean_money(
            inv.get("amount")
        )
    total_customer_amount = sum(amounts_by_customer.values())
    if amounts_by_customer and total_customer_amount > 0:
        fin.top_customer_concentration_pct = round(
            max(amounts_by_customer.values()) / total_customer_amount, 4
        )

    # --- Vintage ---
    if msme.incorporation_date:
        delta = (msme.updated_at or msme.created_at) - msme.incorporation_date
        fin.vintage_years = round(max(delta.days, 0) / 365.25, 2)

    db.add(fin)
    db.flush()
    return fin
