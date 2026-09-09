"""
FinIntel Python Intelligence Service Main FastAPI Application.
Exposes advisory REST API endpoints for category recommendation,
unsupervised anomaly detection, and cash flow forecasting.
"""

import datetime
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from internal.ml import (
    CategoryRecommender,
    AdvisoryAnomalyDetector,
    CashFlowPredictor,
)
from schemas import (
    HealthResponse,
    CategoryPredictionRequest,
    CategoryPredictionResponse,
    BatchCategoryPredictionRequest,
    BatchCategoryPredictionResponse,
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    AnomalyResult,
    CashFlowForecastRequest,
    CashFlowForecastResponse,
    CashFlowSummary,
    ForecastPoint,
    ADVISORY_NOTICE_TEXT,
)

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("finintel-intelligence")

# ML Engine Instances
category_model: CategoryRecommender = None
anomaly_model: AdvisoryAnomalyDetector = None
cashflow_model: CashFlowPredictor = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialize ML models on startup.
    """
    global category_model, anomaly_model, cashflow_model
    logger.info("Initializing FinIntel ML Engine models...")
    category_model = CategoryRecommender()
    anomaly_model = AdvisoryAnomalyDetector()
    cashflow_model = CashFlowPredictor()
    logger.info("FinIntel ML Engine successfully initialized.")
    yield
    logger.info("Shutting down FinIntel ML Engine.")


app = FastAPI(
    title="FinIntel Intelligence & Analytics Service",
    description=(
        "Advisory Python service providing machine-learning category suggestions, "
        "Isolation Forest anomaly detection, and time-series cash flow forecasting."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """
    Service health check endpoint.
    """
    return HealthResponse(
        status="ok",
        service="finintel-intelligence",
        version="1.0.0",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        models_ready=(category_model is not None and anomaly_model is not None and cashflow_model is not None),
    )


@app.post("/api/v1/predict/category", response_model=CategoryPredictionResponse, tags=["Category Recommender"])
async def predict_category(request: CategoryPredictionRequest) -> CategoryPredictionResponse:
    """
    Predict chart-of-accounts category for a single transaction description.
    """
    if category_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Category Recommender model is not initialized.",
        )

    res = category_model.predict(request.description, request.amount or 0.0)
    return CategoryPredictionResponse(
        transaction_id=request.transaction_id,
        predicted_category=res["predicted_category"],
        confidence_score=res["confidence_score"],
        explanation=res["explanation"],
        model_version=res["model_version"],
        top_features=res.get("top_features", []),
        advisory_notice=ADVISORY_NOTICE_TEXT,
    )


@app.post("/api/v1/predict/category/batch", response_model=BatchCategoryPredictionResponse, tags=["Category Recommender"])
async def predict_category_batch(request: BatchCategoryPredictionRequest) -> BatchCategoryPredictionResponse:
    """
    Predict chart-of-accounts categories for a batch of transaction descriptions.
    """
    if category_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Category Recommender model is not initialized.",
        )

    items = [tx.model_dump() for tx in request.transactions]
    batch_results = category_model.predict_batch(items)

    responses = []
    for res in batch_results:
        responses.append(
            CategoryPredictionResponse(
                transaction_id=res.get("transaction_id"),
                predicted_category=res["predicted_category"],
                confidence_score=res["confidence_score"],
                explanation=res["explanation"],
                model_version=res["model_version"],
                top_features=res.get("top_features", []),
                advisory_notice=ADVISORY_NOTICE_TEXT,
            )
        )

    return BatchCategoryPredictionResponse(
        total_processed=len(responses),
        predictions=responses,
        advisory_notice=ADVISORY_NOTICE_TEXT,
    )


@app.post("/api/v1/detect/anomalies", response_model=AnomalyDetectionResponse, tags=["Anomaly Detector"])
async def detect_anomalies(request: AnomalyDetectionRequest) -> AnomalyDetectionResponse:
    """
    Perform multi-feature unsupervised anomaly detection using Isolation Forest.
    """
    if anomaly_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Anomaly Detector model is not initialized.",
        )

    txs = [tx.model_dump() for tx in request.transactions]
    detected = anomaly_model.detect(txs)

    anomaly_count = sum(1 for item in detected if item["is_anomaly"])

    results = []
    for item in detected:
        results.append(
            AnomalyResult(
                transaction_id=item["transaction_id"],
                description=item["description"],
                amount=item["amount"],
                is_anomaly=item["is_anomaly"],
                anomaly_score=item["anomaly_score"],
                severity=item["severity"],
                confidence_score=item["confidence_score"],
                explanation=item["explanation"],
                model_version=item["model_version"],
                advisory_notice=ADVISORY_NOTICE_TEXT,
            )
        )

    return AnomalyDetectionResponse(
        total_scanned=len(results),
        anomaly_count=anomaly_count,
        results=results,
        advisory_notice=ADVISORY_NOTICE_TEXT,
    )


@app.post("/api/v1/forecast/cashflow", response_model=CashFlowForecastResponse, tags=["Cash Flow Predictor"])
async def forecast_cashflow(request: CashFlowForecastRequest) -> CashFlowForecastResponse:
    """
    Generate time-series cash flow projections based on historical entries.
    """
    if cashflow_model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cash Flow Predictor model is not initialized.",
        )

    hist_data = [item.model_dump() for item in request.historical_data]
    res = cashflow_model.predict(hist_data, request.horizon_days)

    summary_obj = CashFlowSummary(
        total_projected_net_flow=res["summary"]["total_projected_net_flow"],
        total_projected_inflow=res["summary"]["total_projected_inflow"],
        total_projected_outflow=res["summary"]["total_projected_outflow"],
        average_daily_net_flow=res["summary"]["average_daily_net_flow"],
    )

    forecast_pts = [
        ForecastPoint(
            date=pt["date"],
            predicted_net_flow=pt["predicted_net_flow"],
            predicted_inflow=pt["predicted_inflow"],
            predicted_outflow=pt["predicted_outflow"],
            lower_bound=pt["lower_bound"],
            upper_bound=pt["upper_bound"],
        )
        for pt in res["forecast_points"]
    ]

    return CashFlowForecastResponse(
        forecast_horizon_days=res["forecast_horizon_days"],
        trend=res["trend"],
        summary=summary_obj,
        confidence_score=res["confidence_score"],
        explanation=res["explanation"],
        model_version=res["model_version"],
        forecast_points=forecast_pts,
        advisory_notice=ADVISORY_NOTICE_TEXT,
    )
