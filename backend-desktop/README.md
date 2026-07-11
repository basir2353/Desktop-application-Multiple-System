# Standalone backend for Railway

Self-contained NestJS API (`api/` + `packages/`). Deploy **only this folder** to Railway — separate from the desktop/mobile apps in the monorepo.

| Piece | Path |
| --- | --- |
| API | [`api/`](./api/) (`@platform/api`) |
| Contracts | [`packages/contracts/`](./packages/contracts/) |
| Database schema | [`packages/database-pg/`](./packages/database-pg/) |

## Railway deploy (recommended)

See **[RAILWAY.md](./RAILWAY.md)** for the full step-by-step guide.

Quick settings:

| Railway setting | Value |
| --- | --- |
| **Root Directory** | `backend-desktop` |
| **Builder** | Dockerfile |
| **Dockerfile path** | `Dockerfile` |
| **Health check** | `/health` |

Copy variables from [`railway.env.example`](./railway.env.example).

## Local development

```bash
cd backend-desktop
cp .env.example .env
pnpm install
pnpm db:push
pnpm dev
```

API runs on `http://127.0.0.1:3000`.

## Seed a hosted Postgres (one-off)

```bash
cd backend-desktop
DATABASE_URL="postgresql://..." \
JWT_ACCESS_SECRET="your-secret-min-32-chars" \
pnpm seed:live
```

## Sync from main monorepo

When you change `backend/api` or root `packages/` in the full repo, refresh this standalone copy:

```bash
cd backend-desktop
pnpm sync:from-monorepo
```

## Docker (local test)

```bash
cd backend-desktop
docker build -t platform-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/platform \
  -e JWT_ACCESS_SECRET=your-secret-min-32-chars \
  platform-api
```

## Clients

Point desktop `.exe` and mobile apps at your Railway domain:

```
VITE_API_BASE_URL=https://YOUR-SERVICE.up.railway.app
EXPO_PUBLIC_API_BASE_URL=https://YOUR-SERVICE.up.railway.app
```

Demo login after seed:

- Email: `admin@platform.local`
- Password: `changeme-please-01`
