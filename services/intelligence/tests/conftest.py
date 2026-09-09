"""
Pytest configuration and shared fixtures.
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Add service root directory to sys.path so imports work seamlessly during tests
service_root = Path(__file__).resolve().parent.parent
if str(service_root) not in sys.path:
    sys.path.insert(0, str(service_root))

from main import app


@pytest.fixture(scope="session")
def client():
    """
    TestClient fixture for FastAPI endpoint integration tests.
    """
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def sample_transactions():
    """
    Sample batch of financial transactions for anomaly detection tests.
    """
    return [
        {"id": "tx-1", "description": "AWS Cloud Web Hosting", "amount": 145.50, "payee": "Amazon Web Services"},
        {"id": "tx-2", "description": "Spectrum Internet Office", "amount": 89.99, "payee": "Spectrum"},
        {"id": "tx-3", "description": "Staples Office Supplies Paper", "amount": 42.10, "payee": "Staples"},
        {"id": "tx-4", "description": "Uber Transport Airport", "amount": 55.00, "payee": "Uber"},
        {"id": "tx-5", "description": "Executive Resort & Yacht Club", "amount": 85000.00, "payee": "Luxury Yachting LLC"},
    ]


@pytest.fixture
def sample_historical_cashflow():
    """
    Sample historical cash flow daily points for cash flow predictor tests.
    """
    import datetime
    base = datetime.date(2026, 8, 1)
    points = []
    for i in range(30):
        d = (base + datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        net = 1000.0 + (i * 20.0) + (150.0 if i % 2 == 0 else -100.0)
        points.append({
            "date": d,
            "net_flow": net,
            "inflow": max(0.0, net + 500.0),
            "outflow": 500.0,
        })
    return points
