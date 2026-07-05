# Backend

Hosted NestJS API and control plane. Clients (web, desktop, mobile) connect to this service when online; local offline queues sync back via `/v1/sync/push`.

| Service | Package | Path |
| --- | --- | --- |
| API | `@platform/api` | [`api/`](./api/) |

## Local development

```bash
# From repository root
docker compose up -d    # PostgreSQL
pnpm db:push            # Apply schema
pnpm dev:api            # NestJS on :3000
```

## Production (self-hosted)

```bash
# Copy and edit production env
cp deployment/.env.production.example deployment/.env.production

# Start API + PostgreSQL
docker compose -f deployment/docker-compose.prod.yml --env-file deployment/.env.production up -d

# Apply schema (first deploy)
docker compose -f deployment/docker-compose.prod.yml --env-file deployment/.env.production run --rm api-migrate
```

Set `CORS_ORIGINS` to your hosted frontend URL(s). Desktop (Tauri) and mobile apps call the API directly and do not need CORS entries.

## Railway (recommended)

See **[RAILWAY.md](./RAILWAY.md)** for the full deploy guide.

1. Railway → New Project → GitHub repo
2. Add **PostgreSQL**
3. Set variables from [`deployment/railway.env.example`](../deployment/railway.env.example)
4. Generate domain → use as `VITE_API_BASE_URL` in clients

## Docker image only

```bash
docker build -f backend/api/Dockerfile -t platform-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/platform \
  -e JWT_ACCESS_SECRET=your-secret-min-32-chars \
  -e CORS_ORIGINS=https://app.yourdomain.com \
  platform-api
```
