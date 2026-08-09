# Intelligence & Analytics Service (`services/intelligence`)

## Overview
`services/intelligence` is a Python analytics service built with FastAPI, pandas, scikit-learn, and statsmodels. It provides machine-learning transaction category suggestions, anomaly detection scores, and cash flow projections.

## Status
* **Milestone 0**: Blueprint directory established. Python service implementation is deferred to **Milestone 4**.

## Critical Architectural Constraint
- **Advisory Boundary**: This service is strictly advisory. It CANNOT directly mutate the PostgreSQL database or automatically post financial journal entries. All outputs must expose confidence score, explanation text, and model version for human review.
