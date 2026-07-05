# Apps

Client applications — all connect to the single backend at `backend/api/`.

| App | Package | Description |
| --- | --- | --- |
| [launcher](./launcher/) | `@platform/launcher` | **Frontend** (browser) + **Desktop** (Tauri `.exe`) |
| [waiter-mobile](./waiter-mobile/) | `@platform/waiter-mobile` | Expo mobile |

## API URL

```bash
# Web + Desktop (.env at repo root)
VITE_API_BASE_URL=https://api.yourdomain.com

# Mobile (apps/waiter-mobile/.env)
EXPO_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

## Online / offline

| App | Offline support |
| --- | --- |
| **launcher (web)** | Store POS localStorage queue, sync outbox on reconnect |
| **launcher (desktop)** | SQLite + sync engine + POS queue |
| **waiter-mobile** | Offline banner; requires network for live orders |

Desktop installers: [launcher/INSTALLER.md](./launcher/INSTALLER.md)
