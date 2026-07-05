# POPS Staff mobile

Expo React Native app for restaurant staff with two roles:

- **Waiter** — sign in, pick a branch, select a table, build orders, and send them to the kitchen.
- **Delivery rider** — sign in, view assigned deliveries, update delivery status, and complete deliveries.

Both roles use separate credentials and are routed to role-specific dashboards after login.

## Prerequisites

- Node 20+, pnpm
- Expo CLI (via project dependencies)
- Running API (`pnpm dev:api` from repo root, or your hosted backend URL in `.env`)
- Android Studio / Xcode for device simulators

## Setup

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_API_BASE_URL`:

| Target | URL |
| --- | --- |
| iOS simulator | `http://127.0.0.1:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| Physical device | `http://<your-lan-ip>:3000` |
| **Hosted production** | `https://api.yourdomain.com` |

After schema changes, run `pnpm db:push` from the repo root and restart the API so rider accounts and delivery endpoints are seeded.

## Development

```bash
# From repository root
pnpm dev:waiter-mobile

# Android (uses scripts/launch-android.sh)
pnpm --filter @platform/waiter-mobile android
```

### Default logins

| Role | Email | Password |
| --- | --- | --- |
| Waiter | `waiter1@platform.local` | `changeme-please-01` |
| Delivery rider | `rider1@platform.local` | `changeme-please-01` |

Waiter orders appear on the desktop launcher **Orders** page within ~10 seconds (kitchen tickets) or immediately when a bill is created.

Delivery assignments and status updates sync in real time with the desktop **Delivery** module.

## Structure

```
app/           Expo Router screens (waiter + rider flows)
src/           API clients, stores, shared UI
scripts/       Platform launch helpers
```
