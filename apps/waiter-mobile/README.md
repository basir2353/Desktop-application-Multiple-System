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
# From repository root — opens POPS Waiter directly in Expo Go (Android emulator)
pnpm dev:waiter-mobile

# Metro only (scan QR / press a for Android / i for iOS)
pnpm dev:waiter-mobile:metro
```

### Expo Go: open the app without a browser

When Expo Go shows its **home screen**, do **not** tap **Log In** (that opens an external browser).

Instead:

1. Tap **POPS Waiter** under **Recently opened**, or
2. Tap **Enter URL manually** and type: `exp://127.0.0.1:8081`

`pnpm dev:waiter-mobile` does this automatically on the Android emulator.

### Default logins

| Role | Email | Password | PIN (mobile) |
| --- | --- | --- | --- |
| Waiter | `waiter1@platform.local` | `changeme-please-01` | `1111` |
| Delivery rider | `rider1@platform.local` | `changeme-please-01` | `6666` |

On the mobile app, enter **branch code** (e.g. `ISB-GT`) and the **4-digit PIN**. PIN auto-submits after the fourth digit.

Waiter orders appear on the desktop launcher **Orders** page within ~10 seconds (kitchen tickets) or immediately when a bill is created.

Delivery assignments and status updates sync in real time with the desktop **Delivery** module.

## Structure

```
app/           Expo Router screens (waiter + rider flows)
src/           API clients, stores, shared UI
scripts/       Platform launch helpers
```
