# Modular desktop installers

Each business system ships as its own **installable `.exe`** (Windows) / `.dmg` (macOS) / `.AppImage` (Linux). The user picks the system **before** running the installer — by double-clicking the setup file for the system they want.

## Available installers

| Installer | Command | Product name | Desktop shortcut |
| --- | --- | --- | --- |
| **Restaurant** | `pnpm installer:restaurant` | Restaurant Management System | Restaurant Management System |
| **General Store** | `pnpm installer:general-store` | General Store Management System | General Store Management System |
| **Pharmacy** | `pnpm installer:pharmacy` | Pharmacy Management System | Pharmacy Management System |
| **Suite** (all systems) | `pnpm --filter @platform/launcher build:suite` | Platform Launcher | Platform Launcher |

Build all three single-system installers:

```bash
pnpm installer:all
```

Output: `apps/launcher/src-tauri/target/release/bundle/` (per platform).

## Installation flow (end user)

1. **Download** the setup file for the business system (e.g. `Restaurant-Management-System_0.1.0_x64-setup.exe`).
2. **Double-click** the setup file — standard Windows installer wizard (Next → Install → Finish).
3. A **desktop shortcut** is created for that system only.
4. **Launch** the app — it opens directly to that system's login → branch select → dashboard.
5. Other business systems are **not installed, not visible, and not routable**.

## What each installer contains

| Edition | Bundled UI | Excluded |
| --- | --- | --- |
| `restaurant` | POPS POS, kitchen, tables, menu, inventory, HR, accounting | Pharmacy + Store pages |
| `general-store` | Retail POS, products, warehouses, purchase flow, reports | Restaurant + Pharmacy pages |
| `pharmacy` | Counter POS, medicines, prescriptions, suppliers, finance | Restaurant + Store pages |
| `suite` | All three (system picker at startup) | — |

Physical exclusion is enforced by the `editionExcludePlugin` Vite plugin: non-selected route modules are stubbed at build time, so their lazy-loaded pages never enter the bundle.

## Development (single-system)

```bash
# Restaurant-only desktop shell
pnpm --filter @platform/launcher dev:restaurant

# Pharmacy-only
pnpm --filter @platform/launcher dev:pharmacy

# General Store-only
pnpm --filter @platform/launcher dev:general-store

# All systems (default)
pnpm dev:launcher
```

## Architecture

```
PLATFORM_EDITION env var
        ↓
vite.config.ts → define __PLATFORM_EDITION__
        ↓
editionExcludePlugin → stubs other systems' route modules
        ↓
edition.ts → HAS_RESTAURANT / HAS_PHARMACY / HAS_GENERAL_STORE
        ↓
App.tsx → only registers routes for available systems
systemStore.ts → locks to baked-in system (single-system builds)
SystemSelectPage → auto-redirects to system dashboard
SystemRouteGuard → blocks cross-system navigation
tauri.<edition>.conf.json → product name, identifier, shortcut label
```

## Adding a new business module

1. Add the system to `BusinessSystemId` in `src/lib/businessSystems.ts`.
2. Create `src/routes/<system>Routes.tsx` with lazy-loaded pages.
3. Register in `App.tsx` behind a `HAS_<SYSTEM>` flag in `src/lib/edition.ts`.
4. Add the route module path to `vite.edition-plugin.ts` `ROUTE_MODULES`.
5. Create `src-tauri/tauri.<system>.conf.json` with product name and identifier.
6. Add `build:<system>` and `dev:<system>` scripts to `package.json`.
7. Add `installer:<system>` to root `package.json`.

No changes to the installer build script or NSIS configuration are required.

## Upgrade / add modules later

Single-system installers are **locked** to their edition. To add another system:

- Install the second system's setup file alongside the first (separate app, separate shortcut), or
- Replace with a **Suite** build that includes all systems and shows the picker at startup.

Future: an in-installer component picker (NSIS custom pages) can be added on top of this modular build pipeline without restructuring the app.

## Prerequisites for building installers

- Node 20+, pnpm
- Rust toolchain
- Windows: WebView2 (usually pre-installed on Windows 10/11)
- Set `VITE_API_BASE_URL` in `.env` before building so the client points at your hosted API
