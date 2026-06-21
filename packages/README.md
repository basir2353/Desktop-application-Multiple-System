# Packages

Shared TypeScript libraries consumed via `workspace:*` across apps and services.

| Package | Name | Purpose |
| --- | --- | --- |
| [auth-client](./auth-client/) | `@platform/auth-client` | Client auth helpers |
| [config](./config/) | — | Shared `tsconfig` bases |
| [contracts](./contracts/) | `@platform/contracts` | API DTOs and shared types |
| [database-pg](./database-pg/) | `@platform/database-pg` | PostgreSQL Drizzle schema |
| [database-sqlite](./database-sqlite/) | `@platform/database-sqlite` | Launcher offline SQLite |
| [permissions](./permissions/) | `@platform/permissions` | RBAC permission constants |
| [shared-types](./shared-types/) | `@platform/shared-types` | Cross-cutting types |
| [shell-sdk](./shell-sdk/) | `@platform/shell-sdk` | Module federation shell API |
| [sync-engine](./sync-engine/) | `@platform/sync-engine` | Outbox and sync utilities |
| [ui](./ui/) | `@platform/ui` | Shared React components |

## Build

Packages build in dependency order via Turbo:

```bash
pnpm build
pnpm --filter @platform/contracts build
```

Most packages expose `dist/` after build. Apps may resolve source via Vite aliases during development.

## Database scripts

Run from the repository root:

```bash
pnpm db:generate   # Generate migrations
pnpm db:migrate    # Run migrations
pnpm db:push       # Push schema (dev)
pnpm db:studio     # Drizzle Studio
```

These delegate to `@platform/database-pg`.
