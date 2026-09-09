"""
Integration tests for FastAPI REST endpoints using TestClient.
"""

import pytest


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "finintel-intelligence"
    assert data["version"] == "1.0.0"
    assert data["models_ready"] is True


def test_predict_category_endpoint(client):
    payload = {
        "transaction_id": "tx-test-01",
        "description": "AWS Cloud Server Compute Subscription",
        "amount": 250.00,
        "payee": "Amazon Web Services",
    }
    response = client.post("/api/v1/predict/category", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["transaction_id"] == "tx-test-01"
    assert data["predicted_category"] == "Software & Subscriptions"
    assert data["confidence_score"] > 0.0
    assert "advisory_notice" in data
    assert "ADVISORY NOTICE" in data["advisory_notice"]


def test_predict_category_batch_endpoint(client):
    payload = {
        "transactions": [
            {
                "transaction_id": "tx-batch-1",
                "description": "Google Cloud Hosting Platform Compute",
                "amount": 100.0,
            },
            {
                "transaction_id": "tx-batch-2",
                "description": "Uber Business Travel Airport Taxi",
                "amount": 45.0,
            },
        ]
    }
    response = client.post("/api/v1/predict/category/batch", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["total_processed"] == 2
    assert len(data["predictions"]) == 2
    assert data["predictions"][0]["predicted_category"] == "Software & Subscriptions"
    assert data["predictions"][1]["predicted_category"] == "Travel & Entertainment"


def test_detect_anomalies_endpoint(client):
    payload = {
        "transactions": [
            {"transaction_id": "tx-1", "description": "Office Coffee", "amount": 15.00},
            {"transaction_id": "tx-2", "description": "Paper Supplies", "amount": 35.00},
            {"transaction_id": "tx-3", "description": "Software Subscription", "amount": 99.00},
            {"transaction_id": "tx-4", "description": "Unexplained Luxury Yacht Transfer", "amount": 95000.00},
        ]
    }
    response = client.post("/api/v1/detect/anomalies", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["total_scanned"] == 4
    assert data["anomaly_count"] >= 1

    high_anomaly = next(r for r in data["results"] if r["transaction_id"] == "tx-4")
    assert high_anomaly["is_anomaly"] is True
    assert high_anomaly["severity"] == "HIGH"
    assert high_anomaly["confidence_score"] >= 0.70


def test_forecast_cashflow_endpoint(client, sample_historical_cashflow):
    payload = {
        "historical_data": sample_historical_cashflow,
        "horizon_days": 15,
    }
    response = client.post("/api/v1/forecast/cashflow", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["forecast_horizon_days"] == 15
    assert len(data["forecast_points"]) == 15
    assert "summary" in data
    assert data["summary"]["total_projected_net_flow"] != 0.0
    assert "ADVISORY NOTICE" in data["advisory_notice"]
