"""
Unit tests for CashFlowPredictor model.
"""

import pytest
from internal.ml.cash_flow_predictor import CashFlowPredictor, MODEL_VERSION


def test_cash_flow_predictor_initialization():
    predictor = CashFlowPredictor()
    assert predictor.model_version == MODEL_VERSION


def test_cash_flow_predictor_with_sample_data(sample_historical_cashflow):
    predictor = CashFlowPredictor()
    horizon = 14
    result = predictor.predict(sample_historical_cashflow, horizon_days=horizon)

    assert result["forecast_horizon_days"] == horizon
    assert len(result["forecast_points"]) == horizon
    assert result["trend"] in ["INCREASING", "DECREASING", "STABLE"]
    assert result["confidence_score"] > 0.0
    assert result["summary"]["total_projected_net_flow"] != 0.0

    first_pt = result["forecast_points"][0]
    assert "date" in first_pt
    assert "predicted_net_flow" in first_pt
    assert "predicted_inflow" in first_pt
    assert "predicted_outflow" in first_pt
    assert "lower_bound" in first_pt
    assert "upper_bound" in first_pt


def test_cash_flow_predictor_fallback_empty_data():
    predictor = CashFlowPredictor()
    result = predictor.predict([], horizon_days=7)

    assert result["forecast_horizon_days"] == 7
    assert len(result["forecast_points"]) == 7
    assert result["trend"] == "STABLE"
    assert "Fallback forecast" in result["explanation"]
