"""
Train a GradientBoosting classifier for MSME risk.

Two data sources:
  1. Synthetic (cold start): samples the feature space (feature_engine.
     FEATURE_NAMES) and labels each sample with a transparent hand-crafted
     rule, so the model can be inspected against it.
  2. Feedback (retraining): real labelled outcomes collected via
     POST /api/v1/feedback (AuditLog FEEDBACK entries joined to the
     ScoreRun.feature_snapshot of the decision they judged). Used when
     enough samples exist (see train_and_save_feedback).

Both paths save the model to settings.model_path and record the version
in settings.features_path so risk_scorer can report it after reload.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split

from app.config import settings
from app.services.feature_engine import FEATURE_NAMES


log = logging.getLogger(__name__)

SYNTHETIC_VERSION = "v1.0-synthetic"
# Minimum feedback rows before we trust real labels over synthetic data
MIN_FEEDBACK_SAMPLES = 30
# OUTCOME_LABEL (feedback_service) values >= this count as default (1)
FEEDBACK_DEFAULT_THRESHOLD = 0.5


def _label_row(features: dict) -> int:
    """1 = default, 0 = healthy. Heuristic that mirrors real-world credit risk."""
    score = 0
    if features["gst_compliance_ratio"] < 0.5:
        score += 3
    elif features["gst_compliance_ratio"] < 0.8:
        score += 1
    if features["bounced_cheques_12m"] >= 3:
        score += 3
    elif features["bounced_cheques_12m"] >= 1:
        score += 1
    if features["revenue_trend_pct"] < -20:
        score += 2
    if features["top_customer_concentration_pct"] > 0.7:
        score += 2
    if features["debt_to_revenue_ratio"] > 0.5:
        score += 3
    elif features["debt_to_revenue_ratio"] > 0.3:
        score += 1
    if features["liquidity_ratio"] < 0.05:
        score += 2
    if features["vintage_years"] < 1:
        score += 1
    if features["utility_payment_consistency"] < 0.8:
        score += 1
    if features["avg_monthly_revenue_inr"] <= 0:
        score += 3
    if features["ebitda_margin_pct"] < 0:
        score += 2
    if features["digital_footprint_score"] < 0.3:
        score += 1
    return 1 if score >= 4 else 0


def _sample_row(rng: np.random.Generator) -> dict:
    annual_rev = float(rng.lognormal(mean=13.0, sigma=1.0)) * 12.0  # monthly ~0.4L-50L
    monthly_rev = annual_rev / 12.0
    row = {
        "avg_monthly_revenue_inr": monthly_rev,
        "revenue_trend_pct": float(rng.normal(2, 25)),
        "ebitda_margin_pct": float(rng.normal(12, 10)),
        "gst_compliance_ratio": float(np.clip(rng.normal(0.85, 0.15), 0, 1)),
        "bounced_cheques_12m": int(max(0, rng.poisson(0.6))),
        "existing_loan_obligations_inr": float(rng.lognormal(mean=11.5, sigma=1.5)),
        "utility_payment_consistency": float(np.clip(rng.normal(0.9, 0.1), 0, 1)),
        "telecom_footprint_score": float(np.clip(rng.normal(0.6, 0.2), 0, 1)),
        "digital_footprint_score": float(np.clip(rng.normal(0.6, 0.2), 0, 1)),
        "top_customer_concentration_pct": float(np.clip(rng.beta(2, 5), 0, 1)),
        "vintage_years": float(np.clip(rng.normal(5, 4), 0, 40)),
        "log_revenue": 0.0,           # filled below
        "debt_to_revenue_ratio": 0.0, # filled below
        "liquidity_ratio": 0.0,       # filled below
        "sector_manufacturing": 0.0,
        "sector_retail": 0.0,
        "sector_services": 0.0,
        "sector_it": 0.0,
        "sector_other": 0.0,
    }
    import math
    # Sample liquidity as a ratio of ANNUAL revenue (median ~0.15) so the
    # <0.05 liquidity rule in _label_row / risk_scorer only fires for a
    # realistic minority, matching seed calibration.
    liquidity = float(np.clip(rng.normal(0.15, 0.10), 0.005, 1.0))
    row["liquidity_ratio"] = liquidity
    row["avg_bank_balance_inr"] = liquidity * annual_rev
    row["log_revenue"] = math.log1p(max(row["avg_monthly_revenue_inr"], 0.0))
    row["debt_to_revenue_ratio"] = row["existing_loan_obligations_inr"] / annual_rev if annual_rev > 0 else 0.0
    sector = rng.choice(["manufacturing", "retail", "services", "it", "other"], p=[0.3, 0.3, 0.2, 0.1, 0.1])
    row[f"sector_{sector}"] = 1.0
    return row


def generate_synthetic_dataset(n: int = 5000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    labels: list[int] = []
    for _ in range(n):
        r = _sample_row(rng)
        rows.append(r)
        labels.append(_label_row(r))
    x = np.array([[r[f] for f in FEATURE_NAMES] for r in rows], dtype=float)
    y = np.array(labels, dtype=int)
    return x, y


def _fit_and_save(x: np.ndarray, y: np.ndarray, version: str) -> dict:
    """Train/test split, fit GradientBoosting, persist model + metadata."""
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42, stratify=y,
    )
    model = GradientBoostingClassifier(
        n_estimators=200, max_depth=3, learning_rate=0.05, random_state=42
    )
    model.fit(x_train, y_train)
    y_pred = model.predict(x_test)
    y_proba = model.predict_proba(x_test)[:, 1]
    auc = roc_auc_score(y_test, y_proba)
    log.info("Model trained (%s). Test AUC=%.4f", version, auc)
    log.info("\n%s", classification_report(y_test, y_pred, target_names=["healthy", "default"]))

    settings.model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, settings.model_path)
    with open(settings.features_path, "w") as f:
        json.dump(
            {"feature_names": FEATURE_NAMES, "test_auc": float(auc), "model_version": version},
            f, indent=2,
        )
    log.info("Saved model to %s (%s)", settings.model_path, version)
    return {
        "test_auc": float(auc),
        "n_train": int(len(x_train)),
        "n_test": int(len(x_test)),
        "model_version": version,
    }


def train_and_save() -> dict:
    log.info("Generating synthetic dataset...")
    x, y = generate_synthetic_dataset()
    log.info("Dataset shape=%s, default rate=%.2f%%", x.shape, y.mean() * 100)
    return _fit_and_save(x, y, SYNTHETIC_VERSION)


def collect_feedback_samples(db) -> tuple[np.ndarray, np.ndarray] | None:
    """Join FEEDBACK audit rows -> Decision -> ScoreRun.feature_snapshot.

    Returns (X, y) with binary labels (1 = default), or None when there are
    not enough samples / labels are single-class / snapshots are missing.
    """
    from app.models.audit_log import AuditAction, AuditLog
    from app.models.decision import Decision
    from app.models.score_run import ScoreRun

    rows = db.query(AuditLog).filter(AuditLog.action == AuditAction.FEEDBACK).all()
    xs: list[list[float]] = []
    ys: list[int] = []
    for row in rows:
        if not row.decision_id:
            continue
        decision = db.get(Decision, row.decision_id)
        if decision is None or not decision.score_run_id:
            continue
        run = db.get(ScoreRun, decision.score_run_id)
        snap = run.feature_snapshot if run else None
        if not snap:
            continue
        label = float((row.details or {}).get("label", -1))
        if label < 0:
            continue
        xs.append([float(snap.get(name, 0.0) or 0.0) for name in FEATURE_NAMES])
        ys.append(1 if label >= FEEDBACK_DEFAULT_THRESHOLD else 0)

    if len(ys) < MIN_FEEDBACK_SAMPLES:
        return None
    y_arr = np.array(ys, dtype=int)
    if len(np.unique(y_arr)) < 2:
        return None  # single-class labels can't train a classifier
    return np.array(xs, dtype=float), y_arr


def train_and_save_feedback(db) -> dict | None:
    """Retrain on real feedback labels. Returns None if feedback is insufficient."""
    samples = collect_feedback_samples(db)
    if samples is None:
        log.info(
            "Feedback retrain skipped: need >=%d labelled samples with both classes",
            MIN_FEEDBACK_SAMPLES,
        )
        return None
    x, y = samples
    version = f"v1.1-feedback-{len(y)}"
    log.info("Retraining on %d feedback samples...", len(y))
    result = _fit_and_save(x, y, version)
    result["n_feedback"] = int(len(y))
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    train_and_save()
