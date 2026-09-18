# Intelligence service

This FastAPI service implements advisory transaction category suggestions, anomaly detection, and cash-flow forecasts using pandas, scikit-learn, and statsmodels.

It cannot write to PostgreSQL or post journal entries. Responses expose confidence/explanation/model metadata for human review by the web and Go services.

## Run and test

```bash
cd services/intelligence
python -m venv .venv
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
python -m pytest
```

Endpoints include `/health`, `/api/v1/predict/category`, batch category prediction, anomaly detection, and cash-flow forecasting. See `main.py` and the Pydantic schemas for the implemented contract.

The Docker image accepts Render’s `PORT` variable. For production, restrict CORS and authenticate calls from the Go API before exposing this service publicly.
