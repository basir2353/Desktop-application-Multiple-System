# Desktop modular platform

Offline-first, federation-based desktop shell with a NestJS control plane, shared TypeScript packages, and a mobile waiter companion app.

## Features

- **Tauri launcher** — React shell with module federation and local SQLite
- **NestJS API** — Auth, POS, kitchen, inventory, HR, accounting, and more
- **Waiter mobile** — Expo app for table-side ordering
- **Shared contracts** — Type-safe API boundaries across clients and server

## Quick start

```bash
cp .env.example .env
pnpm install
docker compose up -d && pnpm db:push
pnpm dev:stack
```

See [docs/getting-started.md](./docs/getting-started.md) for full setup, prerequisites, and troubleshooting.

Default admin login: `admin@platform.local` / `changeme-please-01` (from `.env.example`).

## Repository layout

```
apps/          → launcher, waiter-mobile, federated modules
services/      → NestJS API
packages/      → shared libraries (contracts, DB, UI, sync, …)
docs/          → extended documentation
deployment/    → production deploy manifests (placeholder)
infrastructure/→ IaC templates (placeholder)
```

Full breakdown: [docs/project-structure.md](./docs/project-structure.md)

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev:stack` | API + sample remote + launcher |
| `pnpm dev:api` | NestJS API |
| `pnpm dev:launcher` | Tauri desktop app |
| `pnpm dev:module:sample` | Sample federated remote |
| `pnpm dev:waiter-mobile` | Expo waiter app |
| `pnpm typecheck` | TypeScript check (all packages) |
| `pnpm build` | Production build via Turbo |
| `pnpm db:push` | Apply Drizzle schema to PostgreSQL |
| `pnpm db:studio` | Open Drizzle Studio |

## Waiter mobile

```bash
cp apps/waiter-mobile/.env.example apps/waiter-mobile/.env
pnpm dev:waiter-mobile
```

Details: [apps/waiter-mobile/README.md](./apps/waiter-mobile/README.md)

## Tech stack

- **Monorepo:** pnpm workspaces + Turbo
- **Desktop:** Tauri 2, React 18, Vite, Tailwind
- **Mobile:** Expo 52, React Native
- **Backend:** NestJS 11, Drizzle ORM, PostgreSQL 16
- **Auth:** JWT access + refresh tokens

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
