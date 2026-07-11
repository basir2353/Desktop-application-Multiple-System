# Quick Railway fix

## Error: `couldn't locate the dockerfile at path backend/Dockerfile`

This happens when **Root Directory** and **Dockerfile path** do not match.

### Option A — Deploy from `backend-desktop` (recommended for `backend-desktop-production` service)

In Railway → your API service → **Settings**:

| Setting | Value |
| --- | --- |
| **Root Directory** | `backend-desktop` |
| **Builder** | Dockerfile |
| **Dockerfile path** | `Dockerfile` |

Then **commit and push** the `backend-desktop/` folder to GitHub and redeploy.

### Option B — Deploy full monorepo from repo root

| Setting | Value |
| --- | --- |
| **Root Directory** | *(empty — repo root)* |
| **Builder** | Dockerfile |
| **Dockerfile path** | `backend/Dockerfile` |

Uses root `railway.toml` and `backend/Dockerfile`.

---

**Do not** set Root Directory to `backend` or `backend/api` while Dockerfile path is `backend/Dockerfile` — that path will not exist in the build archive.
