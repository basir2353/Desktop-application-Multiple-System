# Local API for desktop EXE

EXE login screen pe **Local API** choose karo. Yeh folder usi ke liye hai.

## URL

```
http://127.0.0.1:3000
```

## Setup (ek dafa)

1. Docker Desktop install + running
2. Node 20+ + `npm i -g pnpm`
3. Repo root se dependencies: `pnpm install`

## Har baar EXE se pehle

1. Double-click **`start-local.bat`** (window open rakho)
2. Optional: **`seed-local.bat`** (pehli dafa / passwords reset)
3. Check: **`check-health.bat`** → OK hona chahiye
4. EXE kholo → **Local API** select → login

Band karne ke liye: API window band + **`stop-local.bat`**

## Logins (local DB)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `superadmin@pops.platform` | `SuperAdmin@123` |
| Platform Owner | `owner@pops.platform` | `SuperAdmin@123` |
| Restaurant | `admin.restaurant@pops.demo` | `Owner@12345` |
| Pharmacy | `admin.pharmacy@pops.demo` | `Owner@12345` |
| Store | `admin.store@pops.demo` | `Owner@12345` |
| Staff | `cashier1@platform.local` etc. | `Staff@12345` |

Staff PIN: waiter1=`1111` · cashier1=`2222` · manager1=`3333` · kitchen1=`4444` · waiter2=`5555` · rider1=`6666`

## Files

| File | Kaam |
|------|------|
| `.env` | Local Postgres + API + seed vars |
| `start-local.bat` | Postgres + schema + API :3000 |
| `stop-local.bat` | Postgres stop |
| `seed-local.bat` | Demo users / businesses seed |
| `check-health.bat` | API alive? |

Live Railway alag hai — EXE me **Live (Railway)** tab use karo jab internet + Railway up ho.
