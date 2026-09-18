# FinIntel Core API

The Go core API is the authority for tenant-scoped financial operations, double-entry validation, period controls, audit recording, and PostgreSQL access. It uses `chi/v5`, `pgx/v5`, and structured `slog` logging.

## Run and verify

```bash
cd services/api
go run ./cmd/server
gofmt -s -l .
go vet ./...
go test ./...
```

Health endpoints are `GET /health/live` and `GET /health/ready`. Domain endpoints are under `/api/v1`; the canonical public contract is in `contracts/openapi/openapi.yaml`.

## Configuration

| Variable | Purpose |
|---|---|
| `APP_ENV` | `development`, `staging`, or `production` |
| `API_HOST` | Bind address; default `0.0.0.0` |
| `PORT` / `API_PORT` | Bind port; Render-provided `PORT` wins when present |
| `DATABASE_URL` | PostgreSQL/Neon connection URL; use TLS in production |
| `DATABASE_MAX_CONNS` | Pool size; keep conservative for Neon |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact web origins |
| `AUTH_DEV_MODE` | Local-only development authentication; must be `false` in production |
| `OIDC_ISSUER_URL` | Exact OIDC issuer |
| `OIDC_AUDIENCE` | Required access-token audience |
| `OIDC_JWKS_URL` | Provider JWKS endpoint |
| `INTELLIGENCE_SERVICE_URL` | Python advisory service URL |

## Production security gate

The current UI branch’s API middleware still contains development-token and header-derived role behavior. Merge the completed OIDC/RBAC security track before deployment. Production authorization must validate signed tokens and resolve roles from organization membership records; it must never trust a browser-provided role or default to Admin.
