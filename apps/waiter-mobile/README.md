# POPS Staff & Admin mobile

Expo React Native apps for restaurant operations.

## Two APKs only

| APK | Package | Login |
| --- | --- | --- |
| **POPS Staff** | `com.platform.pops.staff` | **Waiter** \| **Rider** tabs → each has **Email** \| **PIN** |
| **POPS Admin** | `com.platform.pops.admin` | Admin / Incharge email + password |

Do **not** ship separate Waiter-only or Rider-only APKs for production — use **Staff**.

## Live API

```env
EXPO_PUBLIC_API_BASE_URL=https://backend-desktop-production-5505.up.railway.app
```

## Build (Windows)

From repo root:

```bat
build-staff-apk.bat
build-admin-apk.bat
```

Outputs:

- `apps/waiter-mobile/dist/pops-staff-release.apk`
- `apps/waiter-mobile/dist/pops-admin-release.apk`

## Demo logins (seeded branches)

| Role | Email | PIN | Branch |
| --- | --- | --- | --- |
| Waiter | `waiter1@platform.local` | `1111` | `ISB-GT` |
| Rider | `rider1@platform.local` | `6666` | `ISB-GT` |
| Admin | `admin.restaurant@pops.demo` | (email only) | — |
| Admin (alias) | `admin@platform.local` | (email only) | — |

Password for Admin demos: `Owner@12345`  
Password for Staff demos: `changeme-please-01` (PIN login preferred)

## Prerequisites

- Node 20+, pnpm
- Android SDK / JDK for release APK
- Running API (local or Railway URL above)

## Structure

```
app/           Expo Router screens (waiter + rider + admin flows)
src/           API clients, stores, shared UI
scripts/       APK build helpers
```

## Admin APK navigation

Bottom tabs: **Home · Orders · Menu · Tax · More**

| Tab | Controls |
| --- | --- |
| Home | Live sales, kitchen, PRA status, branch switcher |
| Orders | Open bills + kitchen queue (advance tickets) |
| Menu | Search / filter · turn items ON/OFF |
| Tax | FPRA/Real/FBR Active · today dashboard · period reports |
| More | Sales, reports, payout, users, tables, kitchen, inventory, printers |
