# Local container environment

The root [`docker-compose.yml`](../../docker-compose.yml) mirrors the distributed production topology with separate web, API, intelligence, migration, and database services.

| Local service | Production analogue |
|---|---|
| `web` | Vercel Next.js deployment |
| `api` | Render Docker web service |
| `intelligence` | Render Docker web service |
| `postgres` | Neon PostgreSQL |
| `migrations` | One-off release migration job |

```bash
docker compose up --build
docker compose ps
docker compose logs -f api web intelligence
```

Stop containers with `docker compose down`. Add `--volumes` only when intentionally deleting the local PostgreSQL data volume.

Local development authentication remains enabled in Compose. Production must set `APP_ENV=production`, `AUTH_DEV_MODE=false`, real OIDC values, restrictive CORS origins, and managed secrets.
