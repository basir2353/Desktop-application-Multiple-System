# Services

Backend services for the platform.

| Service | Package | Description |
| --- | --- | --- |
| [api](./api/) | `@platform/api` | NestJS REST API and control plane |

## Development

```bash
# From repository root
pnpm dev:api
docker compose up -d   # PostgreSQL (first time)
pnpm db:push           # Apply schema
```

The API seeds default users and catalog data on first boot. Credentials are configured in root `.env` (see `.env.example`).

## Docker

Build the API image from `services/api/`:

```bash
docker build -t platform-api services/api
```

Run with `DATABASE_URL` and JWT secrets supplied at runtime.
