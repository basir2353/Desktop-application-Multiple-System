# Railway quick reference

Use the full guide: **[RAILWAY.md](./RAILWAY.md)**

## Required Railway settings

| Setting | Value |
| --- | --- |
| Root Directory | `backend-desktop` |
| Dockerfile path | `Dockerfile` |
| Healthcheck | `/health` |

## After push to GitHub

1. Railway → your API service → **Redeploy**
2. Verify: `curl https://YOUR-DOMAIN.up.railway.app/health/db`
3. Test login: `admin@platform.local` / `changeme-please-01`
