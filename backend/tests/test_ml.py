"""Smoke test for the synthetic ML training pipeline."""
from __future__ import annotations

import os
from pathlib import Path

import joblib
import numpy as np
import pytest


def test_train_synthetic_creates_model(tmp_path, monkeypatch):
    # Redirect model artifacts to tmp
    from app import config
    cfg = config.settings
    monkeypatch.setattr(cfg, "model_path", tmp_path / "risk_model.pkl")
    monkeypatch.setattr(cfg, "features_path", tmp_path / "features.json")

    from app.ml import train_synthetic
    metrics = train_synthetic.train_and_save()

    assert cfg.model_path.exists()
    assert cfg.features_path.exists()
    assert metrics["test_auc"] > 0.5  # better than random on synthetic data
    model = joblib.load(cfg.model_path)
    sample = np.zeros((1, len(train_synthetic.FEATURE_NAMES) if hasattr(train_synthetic, "FEATURE_NAMES") else 1), dtype=float)
    # Just ensure predict_proba works
    x = np.zeros((1, model.n_features_in_), dtype=float)
    prob = model.predict_proba(x)[0]
    assert len(prob) == 2
