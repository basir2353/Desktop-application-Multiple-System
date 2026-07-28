# Backend (backend-desktop)

Hosted NestJS API and control plane. Clients (web, desktop, mobile) connect to this service when online; local offline queues sync back via `/v1/sync/push`.

| Service | Package | Path |
| --- | --- | --- |
| API | `@platform/api` | [`api/`](./api/) |

## Local development

```bash
# From repository root (or from this folder)
cp backend-desktop/.env.example backend-desktop/.env
docker compose up -d    # PostgreSQL (if using local DATABASE_URL)
pnpm db:push            # Apply schema
pnpm --filter @platform/api dev
```

Environment files:

| File | Purpose |
| --- | --- |
| [`.env`](./.env) | **Backend-only** — DB, JWT, CORS, seed (recommended) |
| [`.env`](../.env) | Monorepo root — also includes client `VITE_*` vars |

## Production (self-hosted)

```bash
cp deployment/.env.production.example deployment/.env.production
docker compose -f deployment/docker-compose.prod.yml --env-file deployment/.env.production up -d
docker compose -f deployment/docker-compose.prod.yml --env-file deployment/.env.production run --rm api-migrate
```

## Railway (recommended)

See **[RAILWAY.md](./RAILWAY.md)** for the full deploy guide.

1. Railway → New Project → GitHub repo
2. Add **PostgreSQL**
3. Root Directory: `backend-desktop` · Dockerfile path: `Dockerfile`
4. Set variables from [`railway.env.example`](./railway.env.example)
5. Generate domain → use as `VITE_API_BASE_URL` in clients

## Docker image only

```bash
docker build -f Dockerfile -t platform-api .
# or from repo root:
# docker build -f backend-desktop/Dockerfile -t platform-api backend-desktop

docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/platform \
  -e JWT_ACCESS_SECRET=your-secret-min-32-chars \
  -e CORS_ORIGINS=https://app.yourdomain.com \
  platform-api
```

## Docker Compose (API + Postgres)

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

**Live Railway API:** https://backend-desktop-production-5505.up.railway.app  
Health: https://backend-desktop-production-5505.up.railway.app/health
