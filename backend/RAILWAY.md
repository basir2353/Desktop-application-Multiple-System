# Deploy backend to Railway

Host the NestJS API (`backend/api`) on [Railway](https://railway.com) with a managed PostgreSQL database.

## What Railway runs

| File | Purpose |
| --- | --- |
| [`railway.toml`](../../railway.toml) | Dockerfile builder, pre-deploy schema push, health check |
| [`Dockerfile`](../../Dockerfile) | Monorepo Docker build (repo root) |
| [`backend/api/scripts/start-railway.mjs`](./api/scripts/start-railway.mjs) | Local/manual: schema push + start API |

On each deploy Railway will:

1. Build the Docker image from the repo root
2. Run `drizzle-kit push` in **pre-deploy** (before traffic)
3. Start the API on `PORT` (set automatically by Railway)

## Step-by-step

### 1. Push code to GitHub

Railway deploys from Git. Commit and push your repo if you haven't already.

### 2. Create a Railway project

1. Go to [railway.com](https://railway.com) → **New Project**
2. Choose **Deploy from GitHub repo**
3. Select this repository

### 3. Add PostgreSQL

1. In the project, click **+ New** → **Database** → **PostgreSQL**
2. Wait until the database is running
3. Open the Postgres service → **Variables** → copy `DATABASE_URL` (or use reference variables below)

### 4. Configure the API service

Click your **API service** → **Settings**:

| Setting | Value |
| --- | --- |
| **Root Directory** | **Leave empty** (repo root — **not** `backend/api`) |
| **Builder** | **Dockerfile** |
| **Dockerfile path** | `Dockerfile` |
| **Healthcheck Path** | `/health` |
| **Healthcheck Timeout** | `300` (seconds — first deploy can be slow) |

> **Important:** If Root Directory is `backend/api`, Railway uses Nixpacks and runs `pnpm --filter @platform/api build` without the monorepo — you get **534 TypeScript errors**. The Dockerfile must build from the **repo root**.

### 5. Set environment variables

In the API service → **Variables**, add:

| Variable | Value | Required |
| --- | --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Yes — reference your Postgres service |
| `JWT_ACCESS_SECRET` | Random string, min 32 chars | Yes |
| `NODE_ENV` | `production` | Yes |
| `CORS_ORIGINS` | Your frontend URL(s), comma-separated | Yes for browser |
| `SEED_USER_EMAIL` | `admin@platform.local` | First deploy |
| `SEED_USER_PASSWORD` | Strong password | First deploy |
| `APP_PUBLIC_URL` | Your web app URL | Optional (invite links) |

Example `CORS_ORIGINS`:

```
https://your-app.vercel.app,http://127.0.0.1:1420
```

Include `http://127.0.0.1:1420` for local desktop/web dev against the hosted API.

**Do not set `PORT`** — Railway injects it automatically.

SSL to Postgres is enabled automatically in production (see `packages/database-pg`).

### 6. Generate a public URL

1. API service → **Settings** → **Networking** → **Generate Domain**
2. You get a URL like `https://platform-api-production.up.railway.app`

### 7. Verify deployment

```bash
curl https://YOUR-RAILWAY-DOMAIN.up.railway.app/health
```

Expected: `{"status":"ok","ts":"..."}`

Login test:

```bash
curl -X POST https://YOUR-RAILWAY-DOMAIN.up.railway.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform.local","password":"YOUR-SEED-PASSWORD"}'
```

### 8. Point your clients at Railway

In your local `.env` (repo root):

```bash
VITE_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

Mobile (`apps/waiter-mobile/.env`):

```bash
EXPO_PUBLIC_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

Restart `pnpm dev:web`, `pnpm dev:launcher`, or the mobile app.

## Optional: persistent file uploads

Menu images are stored in `backend/api/data/uploads/`. Railway's filesystem is ephemeral by default.

To keep uploads across deploys:

1. API service → **Volumes** → **Add Volume**
2. Mount path: `/app/backend/api/data/uploads`

## Troubleshooting

| Issue | Fix |
| --- | --- |
| **534 TypeScript errors** / `nest build` fails | Root Directory must be **empty** (repo root). Builder = **Dockerfile**, path = `Dockerfile`. Redeploy. |
| Build uses Nixpacks / `pnpm --filter @platform/api build` | Switch Builder to **Dockerfile** in Settings |
| Build fails | Ensure **Root Directory** is `/` (not `backend/api`) |
| DB connection error | Link `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` |
| CORS blocked in browser | Add your frontend origin to `CORS_ORIGINS` |
| Schema push fails | Check Postgres is running; redeploy after DB is ready |
| **Healthcheck failure** | Open **View logs** on the failed deploy. Common causes: missing `DATABASE_URL`, missing `JWT_ACCESS_SECRET`, or schema push error in pre-deploy. Ensure Postgres service exists and variables are set (see step 5). |
| 502 on health check | First deploy may take 2–3 min for schema push + seed; healthcheck timeout is 300s |

## Architecture

```
Railway Project
├── PostgreSQL          → DATABASE_URL (auto)
└── API (Docker)        → https://xxx.up.railway.app
         ↑
    Web / Desktop / Mobile clients (VITE_API_BASE_URL)
```
