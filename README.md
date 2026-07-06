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
| `pnpm installer:suite` | All-systems `.exe` installer |

## Windows `.exe` installer (hosted API)

The desktop app is built with **Tauri** and ships as a standard Windows setup file (`.exe`). Each installer connects to your **hosted Railway API**.

### 1. Point the client at Railway

In repo-root `.env`:

```bash
VITE_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

On Railway, add `tauri://localhost` to `CORS_ORIGINS` so the desktop app can call the API:

```bash
CORS_ORIGINS=http://127.0.0.1:1420,tauri://localhost
```

### 2. Build on Windows (local)

Requires Node 20+, pnpm, Rust, and WebView2 (pre-installed on Windows 10/11).

```bash
pnpm install
pnpm installer:suite          # all systems — system picker at startup
# or a single business system:
pnpm installer:restaurant
pnpm installer:pharmacy
pnpm installer:general-store
```

Output:

```
apps/launcher/src-tauri/target/release/bundle/nsis/
  Platform-Launcher_0.1.0_x64-setup.exe          # suite
  Restaurant-Management-System_0.1.0_x64-setup.exe
  ...
```

Give users the `*-setup.exe` file. They double-click → Next → Install → desktop shortcut is created.

### 3. Build on macOS/Linux (GitHub Actions)

Windows `.exe` files must be built on Windows. Use the included workflow:

1. Push this repo to GitHub
2. Go to **Actions** → **Build Windows Installer** → **Run workflow**
3. Choose edition (`suite`, `restaurant`, etc.)
4. Enter your Railway API URL as `vite_api_base_url`
5. Download the `.exe` from **Artifacts** when the job finishes (~10–15 min first run)

### Installers available

| Installer | Command | End-user product |
| --- | --- | --- |
| **Suite** (all systems) | `pnpm installer:suite` | Platform Launcher |
| **Restaurant** | `pnpm installer:restaurant` | Restaurant Management System |
| **Pharmacy** | `pnpm installer:pharmacy` | Pharmacy Management System |
| **General Store** | `pnpm installer:general-store` | General Store Management System |

Details: [apps/launcher/INSTALLER.md](./apps/launcher/INSTALLER.md)

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
