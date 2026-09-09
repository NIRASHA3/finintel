"""
Cash Flow Predictor Engine.

Time-series cash flow forecasting module utilizing pandas feature engineering
and Ridge / Linear regression with rolling lags and seasonality trends.
Adheres strictly to advisory boundary guidelines.
"""

import datetime
import logging
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

logger = logging.getLogger(__name__)

MODEL_VERSION = "v1.0.0-ridge-timeseries"


class CashFlowPredictor:
    """
    Predictive time-series cash flow modeling.
    """

    def __init__(self, model_version: str = MODEL_VERSION):
        self.model_version = model_version

    def predict(
        self, historical_data: List[Dict[str, Any]], horizon_days: int = 30
    ) -> Dict[str, Any]:
        """
        Forecast future cash flows based on historical date-indexed cash flow entries.
        """
        if not historical_data:
            # Fallback for empty historical data
            return self._generate_fallback_forecast(horizon_days, "No historical cash flow data provided.")

        # Convert to DataFrame
        df = pd.DataFrame(historical_data)
        if "date" not in df.columns:
            return self._generate_fallback_forecast(horizon_days, "Missing 'date' column in historical data.")

        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        if "net_flow" not in df.columns:
            if "inflow" in df.columns and "outflow" in df.columns:
                df["net_flow"] = df["inflow"] - df["outflow"]
            elif "amount" in df.columns:
                df["net_flow"] = df["amount"]
            else:
                df["net_flow"] = 0.0

        if "inflow" not in df.columns:
            df["inflow"] = df["net_flow"].apply(lambda x: max(0.0, float(x)))
        if "outflow" not in df.columns:
            df["outflow"] = df["net_flow"].apply(lambda x: abs(min(0.0, float(x))))

        n_samples = len(df)
        if n_samples < 5:
            # Simple trend extrapolation for small sample size
            return self._generate_extrapolated_forecast(df, horizon_days)

        # Feature Engineering for Time Series
        df["day_index"] = (df["date"] - df["date"].min()).dt.days
        df["day_of_week"] = df["date"].dt.dayofweek
        df["day_of_month"] = df["date"].dt.day

        # Rolling statistics
        df["rolling_mean_7"] = df["net_flow"].rolling(window=7, min_periods=1).mean()
        df["rolling_std_7"] = df["net_flow"].rolling(window=7, min_periods=1).std().fillna(0.0)

        X = df[["day_index", "day_of_week", "day_of_month", "rolling_mean_7"]].values
        y_net = df["net_flow"].values
        y_in = df["inflow"].values
        y_out = df["outflow"].values

        # Train Ridge Models for Net Flow, Inflow, Outflow
        model_net = Ridge(alpha=1.0)
        model_net.fit(X, y_net)

        model_in = Ridge(alpha=1.0)
        model_in.fit(X, y_in)

        model_out = Ridge(alpha=1.0)
        model_out.fit(X, y_out)

        # Compute historical residuals for confidence intervals
        residuals = y_net - model_net.predict(X)
        std_residual = float(np.std(residuals)) if len(residuals) > 1 else 100.0

        # Generate Future Dates & Forecast
        last_date = df["date"].max()
        last_day_index = df["day_index"].max()
        last_rolling_mean = float(df["rolling_mean_7"].iloc[-1])

        forecast_points = []
        tot_net = 0.0
        tot_in = 0.0
        tot_out = 0.0

        current_rolling_mean = last_rolling_mean

        for i in range(1, horizon_days + 1):
            future_date = last_date + datetime.timedelta(days=i)
            future_day_idx = last_day_index + i
            future_dow = future_date.weekday()
            future_dom = future_date.day

            feat = np.array([[future_day_idx, future_dow, future_dom, current_rolling_mean]])

            pred_net = float(model_net.predict(feat)[0])
            pred_in = max(0.0, float(model_in.predict(feat)[0]))
            pred_out = max(0.0, float(model_out.predict(feat)[0]))

            # Update rolling mean estimate
            current_rolling_mean = 0.8 * current_rolling_mean + 0.2 * pred_net

            lower_b = pred_net - 1.96 * std_residual
            upper_b = pred_net + 1.96 * std_residual

            tot_net += pred_net
            tot_in += pred_in
            tot_out += pred_out

            forecast_points.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "predicted_net_flow": round(pred_net, 2),
                "predicted_inflow": round(pred_in, 2),
                "predicted_outflow": round(pred_out, 2),
                "lower_bound": round(lower_b, 2),
                "upper_bound": round(upper_b, 2),
            })

        # Determine Trend
        slope = float(model_net.coef_[0])
        if slope > 5.0:
            trend = "INCREASING"
        elif slope < -5.0:
            trend = "DECREASING"
        else:
            trend = "STABLE"

        confidence_score = min(0.92, max(0.60, round(1.0 - (std_residual / (abs(float(df['net_flow'].mean())) + 1000.0)), 2)))

        explanation = (
            f"Forecast generated over a {horizon_days}-day horizon utilizing Ridge regression with "
            f"lagged rolling statistics. Detected overall trend is {trend} (trend coefficient: {slope:.3f})."
        )

        return {
            "forecast_horizon_days": horizon_days,
            "trend": trend,
            "summary": {
                "total_projected_net_flow": round(tot_net, 2),
                "total_projected_inflow": round(tot_in, 2),
                "total_projected_outflow": round(tot_out, 2),
                "average_daily_net_flow": round(tot_net / horizon_days, 2),
            },
            "confidence_score": confidence_score,
            "explanation": explanation,
            "model_version": self.model_version,
            "forecast_points": forecast_points,
        }

    def _generate_extrapolated_forecast(self, df: pd.DataFrame, horizon_days: int) -> Dict[str, Any]:
        """
        Extrapolate forecast when dataset is small.
        """
        last_date = df["date"].max()
        avg_net = float(df["net_flow"].mean())
        avg_in = float(df["inflow"].mean()) if "inflow" in df.columns else max(0.0, avg_net)
        avg_out = float(df["outflow"].mean()) if "outflow" in df.columns else abs(min(0.0, avg_net))

        forecast_points = []
        tot_net = 0.0
        tot_in = 0.0
        tot_out = 0.0

        for i in range(1, horizon_days + 1):
            future_date = last_date + datetime.timedelta(days=i)
            forecast_points.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "predicted_net_flow": round(avg_net, 2),
                "predicted_inflow": round(avg_in, 2),
                "predicted_outflow": round(avg_out, 2),
                "lower_bound": round(avg_net * 0.8, 2),
                "upper_bound": round(avg_net * 1.2, 2),
            })
            tot_net += avg_net
            tot_in += avg_in
            tot_out += avg_out

        return {
            "forecast_horizon_days": horizon_days,
            "trend": "STABLE",
            "summary": {
                "total_projected_net_flow": round(tot_net, 2),
                "total_projected_inflow": round(tot_in, 2),
                "total_projected_outflow": round(tot_out, 2),
                "average_daily_net_flow": round(avg_net, 2),
            },
            "confidence_score": 0.70,
            "explanation": f"Small historical dataset ({len(df)} entries); forecast based on mean baseline extrapolation.",
            "model_version": self.model_version,
            "forecast_points": forecast_points,
        }

    def _generate_fallback_forecast(self, horizon_days: int, reason: str) -> Dict[str, Any]:
        """
        Fallback response when no historical data is supplied.
        """
        today = datetime.date.today()
        forecast_points = []
        for i in range(1, horizon_days + 1):
            d = today + datetime.timedelta(days=i)
            forecast_points.append({
                "date": d.strftime("%Y-%m-%d"),
                "predicted_net_flow": 0.0,
                "predicted_inflow": 0.0,
                "predicted_outflow": 0.0,
                "lower_bound": 0.0,
                "upper_bound": 0.0,
            })

        return {
            "forecast_horizon_days": horizon_days,
            "trend": "STABLE",
            "summary": {
                "total_projected_net_flow": 0.0,
                "total_projected_inflow": 0.0,
                "total_projected_outflow": 0.0,
                "average_daily_net_flow": 0.0,
            },
            "confidence_score": 0.50,
            "explanation": f"Fallback forecast: {reason}",
            "model_version": self.model_version,
            "forecast_points": forecast_points,
        }
