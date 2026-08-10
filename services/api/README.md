# FinIntel Core API Service (`services/api`)

## Overview
`services/api` is the Core API backend for FinIntel, built as a portable Go modular monolith. It serves as the single source of truth for business logic, financial ledger entries, database transactions, multi-tenant isolation, and data access.

* **Module Path**: `github.com/NIRASHA3/finintel/services/api`
* **Router**: `chi/v5`
* **Database Driver / Pool**: `pgx/v5` (`pgxpool`)
* **Logging**: Structured JSON logging via standard library `log/slog`

## Component Structure

```text
services/api/
├── cmd/
│   └── server/
│       └── main.go                 # Server entrypoint & graceful OS signal shutdown
├── internal/
│   ├── config/
│   │   ├── config.go               # Environment config loader & production validator
│   │   └── config_test.go          # Config unit tests
│   ├── platform/
│   │   └── database/
│   │       ├── database.go         # pgxpool database connection pool manager
│   │       └── database_test.go    # Connection pool unit tests
│   └── transport/
│       └── http/
│           ├── health.go           # GET /health/live & /health/ready handlers
│           ├── health_test.go      # Health handler unit tests
│           └── router.go           # chi router, middlewares, panic recovery
├── go.mod                          # Go module definition
├── go.sum                          # Go dependency checksums
└── README.md                       # Service documentation
```

## Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `development` | Deployment environment (`development`, `staging`, `production`) |
| `API_HOST` | `0.0.0.0` | Server bind host address |
| `API_PORT` | `8080` | Server bind port |
| `LOG_LEVEL` | `info` | Minimum log severity level (`debug`, `info`, `warn`, `error`) |
| `DATABASE_URL` | `postgres://finintel_user:placeholder_pass@localhost:5432/finintel_dev?sslmode=disable` | PostgreSQL connection string |
| `DATABASE_MAX_CONNS` | `25` | Maximum active PostgreSQL pool connections |

## HTTP Endpoints (Milestone 1)

* `GET /health/live`: Process liveness check. Returns HTTP 200 `{"status": "UP"}`.
* `GET /health/ready`: Dependency readiness check. Returns HTTP 200 `{"status": "UP", "checks": {"database": "UP"}}` when PostgreSQL is connected, or HTTP 503 `{"status": "DOWN", "checks": {"database": "DOWN"}}` when PostgreSQL is unreachable.

## Verification & Local Commands

```bash
# Run unit tests
go test -v ./...

# Run static analysis
go vet ./...

# Check code formatting
gofmt -s -l .
```
