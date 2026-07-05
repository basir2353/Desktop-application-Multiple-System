# Launcher

Unified **frontend** (browser) and **desktop** (Tauri) client. Connects to the single backend at `backend/api/` — works online and offline.

## Development

```bash
pnpm dev:web        # Browser frontend (from repo root)
pnpm dev:launcher   # Desktop app (Tauri)
```

Set `VITE_API_BASE_URL` in root `.env` to your hosted API.

## Offline

- **Web** — store POS queue (localStorage), sync outbox on reconnect
- **Desktop** — WASM SQLite + sync engine + POS queue

## Build

```bash
pnpm build:web              # Static web bundle → dist/
pnpm installer:restaurant   # Restaurant .exe
pnpm installer:pharmacy     # Pharmacy .exe
pnpm installer:general-store # Store .exe
```

Web Docker image: `docker build -f apps/launcher/Dockerfile.web -t platform-web .`

See [INSTALLER.md](./INSTALLER.md) for modular desktop installers.
