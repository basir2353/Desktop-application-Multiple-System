# Getting started

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20+ | See `.nvmrc` |
| pnpm | 9.15.4 | `corepack enable && corepack prepare pnpm@9.15.4 --activate` |
| Docker | Latest | Optional; used for local PostgreSQL |
| Rust | Stable | Required for Tauri desktop builds |
| Xcode CLT / MSVC | Platform SDK | macOS / Windows desktop builds |

## First-time setup

```bash
# 1. Environment
cp .env.example .env
# Edit .env if ports or secrets need changing

# 2. Dependencies
pnpm install

# 3. Database
docker compose up -d
pnpm db:push

# 4. Run the full local stack (API + sample module + launcher)
pnpm dev:stack
```

Default seeded admin credentials are in `.env.example`:

- Email: `admin@platform.local`
- Password: `changeme-please-01`

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:api` | NestJS API only |
| `pnpm dev:launcher` | Tauri desktop shell |
| `pnpm dev:module:sample` | Federated sample remote (port 5001) |
| `pnpm dev:waiter-mobile` | Expo waiter app |
| `pnpm dev:stack` | API + sample module + launcher |
| `pnpm typecheck` | TypeScript across the monorepo |
| `pnpm build` | Production builds via Turbo |
| `pnpm db:studio` | Drizzle Studio for PostgreSQL |

## Waiter mobile app

```bash
cp apps/waiter-mobile/.env.example apps/waiter-mobile/.env
# Set EXPO_PUBLIC_API_BASE_URL (see apps/waiter-mobile/README.md)
pnpm dev:waiter-mobile
```

Sign in as `waiter1@platform.local` / `changeme-please-01`.

## Troubleshooting

**Postgres port conflict** — Change `POSTGRES_HOST_PORT` and `DATABASE_URL` in `.env` to the same free host port.

**Launcher cannot reach API** — Ensure `pnpm dev:api` is running and `VITE_API_BASE_URL` points to `http://127.0.0.1:3000`.

**Module remote fails to load** — Start the sample module with `pnpm dev:module:sample` and verify `VITE_SAMPLE_REMOTE_URL`.
