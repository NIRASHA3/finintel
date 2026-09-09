"""
Pydantic Request and Response Schemas for Python Intelligence Service.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

ADVISORY_NOTICE_TEXT = (
    "ADVISORY NOTICE: All intelligence service predictions, recommendations, and anomaly flags "
    "are purely advisory. This service cannot mutate database states or post financial journal entries directly. "
    "Human review by authorized personnel is required prior to applying outputs."
)


# ------------------------------------------------------------------------------
# Health Check Schema
# ------------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = Field(default="ok", examples=["ok"])
    service: str = Field(default="finintel-intelligence", examples=["finintel-intelligence"])
    version: str = Field(default="1.0.0", examples=["1.0.0"])
    timestamp: str = Field(..., examples=["2026-09-09T11:00:00Z"])
    models_ready: bool = Field(default=True, examples=[True])


# ------------------------------------------------------------------------------
# Category Recommender Schemas
# ------------------------------------------------------------------------------

class CategoryPredictionRequest(BaseModel):
    transaction_id: Optional[str] = Field(None, examples=["tx-1001"], description="Optional unique identifier of transaction")
    description: str = Field(..., examples=["AWS Web Hosting Server Compute"], description="Raw transaction text string")
    amount: Optional[float] = Field(0.0, examples=[150.00], description="Transaction monetary amount")
    payee: Optional[str] = Field(None, examples=["Amazon Web Services"], description="Payee or vendor name")


class CategoryPredictionResponse(BaseModel):
    transaction_id: Optional[str] = Field(None, examples=["tx-1001"])
    predicted_category: str = Field(..., examples=["Software & Subscriptions"])
    confidence_score: float = Field(..., examples=[0.9450], ge=0.0, le=1.0)
    explanation: str = Field(..., examples=["Suggested 'Software & Subscriptions' based on keywords: aws, server, cloud"])
    model_version: str = Field(..., examples=["v1.0.0-tfidf-ensemble"])
    top_features: List[str] = Field(default_factory=list, examples=[["aws", "server"]])
    advisory_notice: str = Field(default=ADVISORY_NOTICE_TEXT)


class BatchCategoryPredictionRequest(BaseModel):
    transactions: List[CategoryPredictionRequest] = Field(..., min_length=1)


class BatchCategoryPredictionResponse(BaseModel):
    total_processed: int = Field(..., examples=[5])
    predictions: List[CategoryPredictionResponse]
    advisory_notice: str = Field(default=ADVISORY_NOTICE_TEXT)


# ------------------------------------------------------------------------------
# Advisory Anomaly Detector Schemas
# ------------------------------------------------------------------------------

class AnomalyItem(BaseModel):
    transaction_id: Optional[str] = Field(None, examples=["tx-8801"])
    description: str = Field(..., examples=["Executive Hotel Suite & Travel"])
    amount: float = Field(..., examples=[75000.00])
    payee: Optional[str] = Field(None, examples=["Luxury Resort Corp"])
    transaction_date: Optional[str] = Field(None, examples=["2026-09-08"])


class AnomalyDetectionRequest(BaseModel):
    transactions: List[AnomalyItem] = Field(..., min_length=1)


class AnomalyResult(BaseModel):
    transaction_id: str = Field(..., examples=["tx-8801"])
    description: str = Field(..., examples=["Executive Hotel Suite & Travel"])
    amount: float = Field(..., examples=[75000.00])
    is_anomaly: bool = Field(..., examples=[True])
    anomaly_score: float = Field(..., examples=[-0.285])
    severity: str = Field(..., examples=["HIGH"], description="HIGH, MEDIUM, or LOW")
    confidence_score: float = Field(..., examples=[0.91], ge=0.0, le=1.0)
    explanation: str = Field(..., examples=["High-value entry of $75,000.00 is 3.5x batch average."])
    model_version: str = Field(..., examples=["v1.0.0-isolation-forest"])
    advisory_notice: str = Field(default=ADVISORY_NOTICE_TEXT)


class AnomalyDetectionResponse(BaseModel):
    total_scanned: int = Field(..., examples=[10])
    anomaly_count: int = Field(..., examples=[1])
    results: List[AnomalyResult]
    advisory_notice: str = Field(default=ADVISORY_NOTICE_TEXT)


# ------------------------------------------------------------------------------
# Cash Flow Predictor Schemas
# ------------------------------------------------------------------------------

class HistoricalCashFlowItem(BaseModel):
    date: str = Field(..., examples=["2026-08-01"])
    amount: Optional[float] = Field(None, examples=[1200.00])
    net_flow: Optional[float] = Field(None, examples=[1200.00])
    inflow: Optional[float] = Field(None, examples=[2000.00])
    outflow: Optional[float] = Field(None, examples=[800.00])


class CashFlowForecastRequest(BaseModel):
    historical_data: List[HistoricalCashFlowItem] = Field(default_factory=list)
    horizon_days: int = Field(default=30, ge=1, le=365, examples=[30])


class ForecastPoint(BaseModel):
    date: str = Field(..., examples=["2026-09-10"])
    predicted_net_flow: float = Field(..., examples=[1250.00])
    predicted_inflow: float = Field(..., examples=[2200.00])
    predicted_outflow: float = Field(..., examples=[950.00])
    lower_bound: float = Field(..., examples=[900.00])
    upper_bound: float = Field(..., examples=[1600.00])


class CashFlowSummary(BaseModel):
    total_projected_net_flow: float = Field(..., examples=[37500.00])
    total_projected_inflow: float = Field(..., examples=[66000.00])
    total_projected_outflow: float = Field(..., examples=[28500.00])
    average_daily_net_flow: float = Field(..., examples=[1250.00])


class CashFlowForecastResponse(BaseModel):
    forecast_horizon_days: int = Field(..., examples=[30])
    trend: str = Field(..., examples=["INCREASING"], description="INCREASING, DECREASING, or STABLE")
    summary: CashFlowSummary
    confidence_score: float = Field(..., examples=[0.88], ge=0.0, le=1.0)
    explanation: str = Field(..., examples=["Forecast generated using Ridge regression model with lag features."])
    model_version: str = Field(..., examples=["v1.0.0-ridge-timeseries"])
    forecast_points: List[ForecastPoint]
    advisory_notice: str = Field(default=ADVISORY_NOTICE_TEXT)
