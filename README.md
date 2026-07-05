# Desktop Application — Multi-System ERP Platform

Single **backend**, one **frontend** (web + desktop), and **mobile apps** — all online and offline capable.

**Repository:** [github.com/basir2353/Desktop-application-Multiple-System](https://github.com/basir2353/Desktop-application-Multiple-System)

## Structure

```
backend/api/       → NestJS API (host this online)
apps/
  launcher/        → React frontend + Tauri desktop (.exe installers)
  waiter-mobile/   → Expo mobile app
packages/          → Shared contracts, DB, connectivity, sync
```

| Client | Online | Offline |
| --- | --- | --- |
| **Backend** | Hosted API + PostgreSQL | — |
| **Web** (`pnpm dev:web`) | Calls hosted API | POS queue, sync outbox |
| **Desktop** (`pnpm dev:launcher`) | Calls hosted API | SQLite, sync engine, POS queue |
| **Mobile** | Calls hosted API | Offline banner, retries when back |

All clients point at the same backend via `VITE_API_BASE_URL` / `EXPO_PUBLIC_API_BASE_URL`.

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:push
pnpm dev:stack          # API + frontend
```

Default login: `admin@platform.local` / `changeme-please-01`

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev:stack` | API + frontend |
| `pnpm dev:api` | Backend only |
| `pnpm dev:web` | Frontend in browser |
| `pnpm dev:launcher` | Desktop app (Tauri) |
| `pnpm dev:waiter-mobile` | Mobile app |
| `pnpm installer:restaurant` | Restaurant `.exe` installer |
| `pnpm installer:pharmacy` | Pharmacy `.exe` installer |
| `pnpm installer:general-store` | Store `.exe` installer |

## Host backend on Railway

1. Deploy on [railway.com](https://railway.com) from this GitHub repo
2. Add a **PostgreSQL** plugin
3. Set env vars (see [backend/RAILWAY.md](./backend/RAILWAY.md))
4. Generate a public domain
5. Point clients at it:

```bash
VITE_API_BASE_URL=https://your-api.up.railway.app
EXPO_PUBLIC_API_BASE_URL=https://your-api.up.railway.app
```

Full guide: **[backend/RAILWAY.md](./backend/RAILWAY.md)**

## Host backend (self-hosted Docker)

```bash
cp deployment/.env.production.example deployment/.env.production
docker compose -f deployment/docker-compose.prod.yml \
  --env-file deployment/.env.production up -d --build
```

See [deployment/README.md](./deployment/README.md).

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL |
| `JWT_ACCESS_SECRET` | JWT signing |
| `VITE_API_BASE_URL` | API URL for web + desktop |
| `EXPO_PUBLIC_API_BASE_URL` | API URL for mobile |
| `CORS_ORIGINS` | Allowed web origins (production) |

## License

[MIT](./LICENSE)
