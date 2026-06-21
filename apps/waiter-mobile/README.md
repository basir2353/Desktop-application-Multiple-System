# Waiter mobile

Expo React Native app for waiters: sign in, pick a branch, select a table, build orders, and send them to the kitchen.

## Prerequisites

- Node 20+, pnpm
- Expo CLI (via project dependencies)
- Running API (`pnpm dev:api` from repo root)
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

## Development

```bash
# From repository root
pnpm dev:waiter-mobile

# Android (uses scripts/launch-android.sh)
pnpm --filter @platform/waiter-mobile android
```

Default waiter login: `waiter1@platform.local` / `changeme-please-01`

Orders appear on the desktop launcher **Orders** page within ~10 seconds (kitchen tickets) or immediately when a bill is created.

## Structure

```
app/           Expo Router screens
src/           API clients, stores, shared UI
scripts/       Platform launch helpers
```
