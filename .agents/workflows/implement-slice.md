# Workflow: Implement Vertical Slice

## Objective
Implement a feature cleanly across database, Go API, Python intelligence (if applicable), and Next.js web components in a disciplined vertical slice.

## Steps

1. **Database & Queries Layer**:
   - Write SQL migration file in `database/migrations/`.
   - Write sqlc queries in `database/queries/` and generate Go type definitions.

2. **Go Core API Layer (`services/api`)**:
   - Implement domain models and accounting validation logic.
   - Implement storage repository calls using generated sqlc.
   - Write HTTP controllers with tenant authorization checks.

3. **Intelligence Layer (`services/intelligence`) [Optional]**:
   - If feature requires predictions/anomaly scores, implement FastAPI endpoint in Python.
   - Ensure response format includes confidence score, explanation, and model version.

4. **Web Frontend Layer (`apps/web`)**:
   - Implement React UI components adhering to Tailwind design tokens.
   - Wire API requests using typed fetch hooks.
   - Display human-in-the-loop approval workflows for AI recommendations.

5. **Audit & Logging**:
   - Ensure all mutations generate structured audit events with correlation ID.
