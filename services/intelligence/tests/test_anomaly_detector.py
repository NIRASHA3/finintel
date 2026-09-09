"""
Unit tests for AdvisoryAnomalyDetector model.
"""

import pytest
from internal.ml.anomaly_detector import AdvisoryAnomalyDetector, MODEL_VERSION


def test_anomaly_detector_initialization():
    detector = AdvisoryAnomalyDetector()
    assert detector.model_version == MODEL_VERSION
    assert detector.contamination == 0.1


def test_anomaly_detector_detects_extreme_outlier(sample_transactions):
    detector = AdvisoryAnomalyDetector()
    results = detector.detect(sample_transactions)

    assert len(results) == len(sample_transactions)

    # Find the high-value transaction (tx-5)
    tx5_res = next(r for r in results if r["transaction_id"] == "tx-5")

    assert tx5_res["is_anomaly"] is True
    assert tx5_res["severity"] == "HIGH"
    assert tx5_res["confidence_score"] >= 0.70
    assert "85,000" in tx5_res["explanation"] or "High-value" in tx5_res["explanation"] or "Isolation" in tx5_res["explanation"]


def test_anomaly_detector_normal_transactions(sample_transactions):
    detector = AdvisoryAnomalyDetector()
    results = detector.detect(sample_transactions)

    # Find normal transactions
    tx1_res = next(r for r in results if r["transaction_id"] == "tx-1")

    assert tx1_res["is_anomaly"] is False
    assert tx1_res["severity"] == "LOW"
    assert tx1_res["confidence_score"] > 0.0


def test_anomaly_detector_empty_list():
    detector = AdvisoryAnomalyDetector()
    results = detector.detect([])
    assert results == []
