# Deployment

Production stack: **one backend** + **one web frontend** + PostgreSQL.

```bash
cp deployment/.env.production.example deployment/.env.production
# Edit passwords, CORS_ORIGINS, VITE_API_BASE_URL

docker compose -f deployment/docker-compose.prod.yml \
  --env-file deployment/.env.production up -d --build

docker compose -f deployment/docker-compose.prod.yml \
  --env-file deployment/.env.production run --rm api-migrate
```

| Service | Port | Role |
| --- | --- | --- |
| `api` | 3000 | NestJS backend (host online) |
| `web` | 8080 | React frontend (`apps/launcher` web build) |
| `postgres` | 5432 | Database |

## Clients (all use the same backend)

| Client | Command | Offline |
| --- | --- | --- |
| Web | `pnpm dev:web` | Store POS queue + sync outbox |
| Desktop | `pnpm dev:launcher` | SQLite + sync engine + POS queue |
| Mobile | `pnpm dev:waiter-mobile` | Offline banner; syncs when API reachable |

Set `VITE_API_BASE_URL` / `EXPO_PUBLIC_API_BASE_URL` to your hosted API URL.
