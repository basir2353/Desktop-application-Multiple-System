# Desktop Application — Multi-System ERP Platform

Offline-first desktop ERP platform with a Tauri launcher, NestJS API, and PostgreSQL. Run **Restaurant (POPS)**, **Pharmacy**, or **General Store** from one codebase — pick a business system at login, then work inside a shared branch-aware shell.

**Repository:** [github.com/basir2353/Desktop-application-Multiple-System](https://github.com/basir2353/Desktop-application-Multiple-System)

## Business systems

| System | Description | Entry route |
| --- | --- | --- |
| **Restaurant ERP (POPS)** | POS, kitchen, tables, menu, inventory, HR, accounting | `/pops/dashboard` |
| **Pharmacy ERP** | Counter POS, medicines, batches/expiry, prescriptions, suppliers | `/pops/pharmacy/dashboard` |
| **General Store ERP** | Retail POS, products, purchase flow (PR → PO → GRN), warehouses, reports | `/pops/store/dashboard` |

Each vertical includes its own database schema, API module (`/v1/pharmacy`, `/v1/store`), contracts, and frontend pages under `apps/launcher/src/`.

## Features

- **Multi-system launcher** — system picker, branch selection, role-based access
- **Tauri desktop app** — React shell with local SQLite runtime DB
- **NestJS API** — Auth, inventory, billing, HR, accounting, pharmacy, store modules
- **Shared packages** — Type-safe contracts, Drizzle PostgreSQL schema, UI kit
- **Waiter mobile** — Expo companion app for table-side ordering (restaurant)

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 9.15.4 (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Docker (for local PostgreSQL)
- Rust (for Tauri desktop builds)

### Setup

```bash
git clone https://github.com/basir2353/Desktop-application-Multiple-System.git
cd Desktop-application-Multiple-System

cp .env.example .env
pnpm install
docker compose up -d
pnpm db:push
pnpm dev:stack
```

Default admin login (from `.env.example`):

- **Email:** `admin@platform.local`
- **Password:** `changeme-please-01`

Change `JWT_ACCESS_SECRET` and seed credentials before any production deployment.

See [docs/getting-started.md](./docs/getting-started.md) for full setup and troubleshooting.

## Development scripts

| Command | Description |
| --- | --- |
| `pnpm dev:stack` | API + sample federated module + launcher |
| `pnpm dev:api` | NestJS API only |
| `pnpm dev:launcher` | Tauri desktop app |
| `pnpm dev:waiter-mobile` | Expo waiter app |
| `pnpm typecheck` | TypeScript check (all packages) |
| `pnpm build` | Production build via Turbo |
| `pnpm db:push` | Apply Drizzle schema to PostgreSQL |
| `pnpm db:studio` | Open Drizzle Studio |

## Repository layout

```
apps/
  launcher/          → Tauri desktop shell (POPS + Pharmacy + Store UI)
  waiter-mobile/     → Expo waiter companion
services/
  api/               → NestJS control plane (pharmacy, store, inventory, …)
packages/
  contracts/         → Shared Zod schemas & TypeScript types
  database-pg/       → Drizzle PostgreSQL schema
  ui/                → Shared React UI components
docs/                → Extended documentation
```

Full breakdown: [docs/project-structure.md](./docs/project-structure.md)

## Environment variables

Copy `.env.example` to `.env` at the repo root. Key variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | JWT signing secret (min 32 chars in production) |
| `VITE_API_BASE_URL` | API URL for the launcher (default `http://127.0.0.1:3000`) |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | Initial admin user on first API boot |

Never commit `.env` — it is listed in `.gitignore`.

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
