# Deploy `backend-desktop` to Railway

Standalone API for the POPS desktop `.exe` and mobile apps. This folder is **self-contained** — Railway only needs `backend-desktop/`, not the full monorepo.

## 1. Push to GitHub

Commit and push the repo (including the `backend-desktop/` folder):

```bash
git add backend-desktop
git commit -m "Update standalone backend for Railway"
git push origin main
```

## 2. Create Railway project

1. Go to [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo**
2. Select your repository

## 3. Add PostgreSQL

1. In the project → **+ New** → **Database** → **PostgreSQL**
2. Wait until it is running

## 4. Configure the API service

Click the **API service** (not Postgres) → **Settings**:

| Setting | Value |
| --- | --- |
| **Service name** | `@platform/api` or `backend-desktop-production` |
| **Root Directory** | `backend-desktop` |
| **Builder** | Dockerfile |
| **Dockerfile path** | `Dockerfile` |
| **Healthcheck Path** | `/health` |
| **Healthcheck Timeout** | `300` |

> **Important:** Root Directory must be `backend-desktop`. Do **not** use repo root or `backend/api` — those paths break the Docker build.

## 5. Environment variables

API service → **Variables** → paste from [`railway.env.example`](./railway.env.example):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_ACCESS_SECRET` | Random string, min 32 chars |
| `NODE_ENV` | `production` |
| `SEED_USER_EMAIL` | `admin@platform.local` |
| `SEED_USER_PASSWORD` | `changeme-please-01` |
| `CORS_ORIGINS` | `http://127.0.0.1:1420,tauri://localhost,https://tauri.localhost` |

Do **not** set `PORT` — Railway injects it.

## 6. Public domain

1. API service → **Settings** → **Networking** → **Generate Domain**
2. You get a URL like `https://backend-desktop-production-xxxx.up.railway.app`
3. Use this URL in:
   - Root `.env` → `VITE_API_BASE_URL` and `EXPO_PUBLIC_API_BASE_URL`
   - Rebuild desktop `.exe` and mobile APKs if the URL changed

## 7. Deploy

Click **Deploy** → **Redeploy** (or push to GitHub for auto-deploy).

On each deploy Railway will:

1. Build Docker image from `backend-desktop/Dockerfile`
2. Run `drizzle-kit push` (apply DB schema)
3. Run idempotent seed boot (demo org + admin user)
4. Start the API on Railway `PORT`

First deploy may take 2–3 minutes.

## 8. Verify

```bash
# Health
curl https://YOUR-DOMAIN.up.railway.app/health

# DB readiness (after latest deploy)
curl https://YOUR-DOMAIN.up.railway.app/health/db

# Login
curl -X POST https://YOUR-DOMAIN.up.railway.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@platform.local","password":"changeme-please-01"}'
```

Expected login response: JSON with `accessToken`, `refreshToken`, `expiresIn`.

## 9. Desktop app login

After API works:

1. Set `VITE_API_BASE_URL=https://YOUR-DOMAIN.up.railway.app` in repo root `.env`
2. Rebuild installer: `pnpm installer:windows`
3. Install the new `.exe`
4. Sign in: `admin@platform.local` / `changeme-please-01`

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `couldn't locate dockerfile at path backend/Dockerfile` | Set Root Directory = `backend-desktop`, Dockerfile = `Dockerfile` |
| Login 500 | Redeploy after latest push; check `/health/db` for missing tables |
| Login 401 | Wrong password, or run `pnpm seed:live` with Railway `DATABASE_URL` |
| Build fails | Ensure `backend-desktop/pnpm-lock.yaml` is committed |
| Schema push fails | Check `DATABASE_URL` references Postgres service |

## Optional: seed from your PC

```bash
cd backend-desktop
DATABASE_URL="postgresql://..." \
JWT_ACCESS_SECRET="same-as-railway" \
pnpm seed:live
```

Use the **public** Postgres URL from Railway → Postgres → Connect (one-off only).
