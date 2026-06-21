# Launcher

Tauri + React desktop application. Hosts federated modules, runs the POPS restaurant/retail UI, and bootstraps local WASM SQLite for offline-first behavior.

## Prerequisites

- Node 20+, pnpm
- Rust toolchain (for `tauri dev` / `tauri build`)
- Running API (`pnpm dev:api` from repo root)

## Development

```bash
# From repository root
pnpm dev:launcher

# Web-only (no Tauri shell)
pnpm --filter @platform/launcher dev:web
```

Environment variables are loaded from the root `.env` (see `.env.example`):

- `VITE_API_BASE_URL` — API base URL (defaults to `http://127.0.0.1:3000` in dev)
- `VITE_SAMPLE_REMOTE_URL` — Federated sample module entry

## Structure

```
src/           React app (pages, POPS modules, stores)
src-tauri/     Rust backend, Tauri config, icons
public/        Static assets including sql-wasm
scripts/       Postinstall helpers
```

## Build

```bash
pnpm --filter @platform/launcher build        # Tauri release
pnpm --filter @platform/launcher build:web    # Vite bundle only
```
