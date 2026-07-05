# Project structure

```
.
├── backend/api/           # Single NestJS API (host online)
├── apps/
│   ├── launcher/          # React frontend + Tauri desktop
│   └── waiter-mobile/     # Expo mobile
├── packages/              # Shared libraries
├── deployment/            # Production Docker Compose
├── docs/
├── docker-compose.yml     # Local PostgreSQL
└── .env                   # API + client URLs
```

## Data flow

```mermaid
flowchart LR
  Web["launcher (web)"]
  Desktop["launcher (desktop)"]
  Mobile["waiter-mobile"]
  API["backend/api"]
  PG[(PostgreSQL)]

  Web -->|online| API
  Desktop -->|online| API
  Desktop -->|offline| SQLite
  Mobile --> API
  API --> PG
  SQLite -->|sync| API
```

## Offline

- **Web / Desktop** — `@platform/connectivity` queues, `@platform/sync-engine` outbox, SQLite (desktop)
- **Mobile** — detects network failures, shows offline banner, retries when API is reachable
