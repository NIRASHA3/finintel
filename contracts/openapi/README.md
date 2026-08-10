# OpenAPI Specification (`contracts/openapi`)

## Overview
This directory contains the canonical OpenAPI 3.1 specification (`openapi.yaml`) representing the REST API contract between the Next.js frontend client (`apps/web`) and the Go core API (`services/api`).

## Status
* **Milestone 1**: Foundation established. Health endpoints (`GET /health/live` and `GET /health/ready`) defined with sanitized schemas and HTTP status codes (`200 OK`, `503 Service Unavailable`). Automated CLI validation configured via Redocly.

## Validation Commands
Run from project root:

```bash
# Validate OpenAPI specification
pnpm lint:openapi
```
