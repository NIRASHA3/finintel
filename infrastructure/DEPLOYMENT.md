# Deployment guide: Vercel, Neon, and Render

This deployment uses free/low-cost managed platforms and does not require AWS or Terraform.

## Release blockers

Do not expose the application publicly until the OIDC/BFF security track is integrated into the UI branch. Production must not contain hard-coded development tokens, accept `X-User-Role` as authority, or default a missing role to Admin. Complete the E2E release gates before launch.

## 1. Prepare GitHub

1. Merge the reviewed UI and OIDC/RBAC work into the deployment branch.
2. Confirm CI passes for web, Go, Python, OpenAPI, PostgreSQL integration/security, container builds, and E2E tests.
3. Keep `.env`, database URLs, OIDC client secrets, and service keys out of GitHub.

## 2. Create Neon PostgreSQL

1. Create a Neon project and production database.
2. Copy the pooled connection string for the API runtime and require TLS (`sslmode=require`).
3. Run `goose -dir database/migrations postgres "$DATABASE_URL" up` from a trusted machine or a one-off Render job before starting the API.
4. Use separate least-privilege runtime credentials when the security migration provides them. Never run the API as the database owner.
5. Keep Neon’s direct connection string for migrations if required; use the pooled string for normal API traffic.

## 3. Deploy intelligence to Render

1. Create a Render **Web Service** from the GitHub repository.
2. Select **Docker**, use `services/intelligence/Dockerfile`, and set the build context to `services/intelligence`.
3. Set the health-check path to `/health`. Render supplies `PORT`; the image binds to it automatically.
4. Deploy and record the HTTPS service URL.

The intelligence service is advisory only. Prefer private Render networking when available; otherwise authenticate service-to-service requests before public launch.

## 4. Deploy the Go API to Render

1. Create a second Render **Web Service**.
2. Select **Docker**, use `services/api/Dockerfile`, and use the repository root as build context.
3. Set the health-check path to `/health/ready`.
4. Configure:

```text
APP_ENV=production
LOG_LEVEL=info
DATABASE_URL=<Neon pooled TLS URL>
DATABASE_MAX_CONNS=10
CORS_ALLOWED_ORIGINS=https://<your-vercel-domain>
AUTH_DEV_MODE=false
OIDC_ISSUER_URL=<issuer>
OIDC_AUDIENCE=finintel-api
OIDC_JWKS_URL=<issuer JWKS URL>
INTELLIGENCE_SERVICE_URL=<Render intelligence URL>
```

Render supplies `PORT`, which the API accepts when `API_PORT` is unset. Deploy and verify `/health/live` and `/health/ready` over HTTPS.

## 5. Deploy the web app to Vercel

1. Import the GitHub repository into Vercel.
2. Set the root directory to `apps/web`; Vercel should detect Next.js.
3. Use `pnpm install --frozen-lockfile` and `pnpm build` if workspace commands are not inferred.
4. Set `NEXT_PUBLIC_API_URL=https://<render-api-domain>` for Preview and Production.
5. Add the OIDC/BFF server-only variables required by the integrated security track. Never expose client secrets with a `NEXT_PUBLIC_` prefix.
6. Add production and intentional preview domains to the API CORS policy and OIDC callback allow-list.

## 6. Validate production

- Run migrations before the new API revision receives traffic.
- Confirm HTTPS, secure cookies, callback URLs, issuer/audience validation, sign-out, and session expiry.
- Exercise every role against allowed and forbidden actions.
- Confirm two tenants cannot read or mutate each other’s records.
- Run the plan in [`tests/e2e/README.md`](../tests/e2e/README.md).
- Configure logs, uptime checks, database backups, and secret rotation.

Free tiers may sleep, throttle, or change limits. Confirm current platform quotas before launch and do not claim an availability SLA the selected plans do not provide.
