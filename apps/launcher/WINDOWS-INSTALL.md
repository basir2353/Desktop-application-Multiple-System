# POPS Launcher — Windows installation guide

This guide explains how to **download**, **run**, and **use** the Windows setup file (`.exe`) for POPS Launcher and related business-system installers.

---

## What you receive

The setup file is a standard Windows installer. It is **not** the app itself — it installs the desktop application on your PC.

| Edition | Setup file name (example) | App name after install |
| --- | --- | --- |
| **Suite** (all systems) | `POPS-Launcher_0.1.0_x64-setup.exe` | POPS Launcher |
| **Restaurant** | `Restaurant-Management-System_0.1.0_x64-setup.exe` | Restaurant Management System |
| **Pharmacy** | `Pharmacy-Management-System_0.1.0_x64-setup.exe` | Pharmacy Management System |
| **General Store** | `General-Store-Management-System_0.1.0_x64-setup.exe` | General Store Management System |

> Version numbers in the file name may change (e.g. `0.2.0`). The pattern is always `Product-Name_<version>_x64-setup.exe`.

---

## System requirements

| Requirement | Details |
| --- | --- |
| **OS** | Windows 10 or Windows 11 (64-bit) |
| **RAM** | 4 GB minimum; 8 GB recommended |
| **Disk space** | ~200 MB free for the app |
| **Internet** | Required for login, sync, and API calls (offline POS queue works when connectivity returns) |
| **WebView2** | Usually pre-installed on Windows 10/11. If the app fails to open, install [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| **Admin rights** | **Not required** — the installer uses per-user install mode |

---

## Step 1 — Get the setup file

### Option A — Download from your administrator

Your IT admin or vendor should give you the correct `*-setup.exe` for your business (suite, restaurant, pharmacy, or store).

### Option B — Build from source (developers)

On a **Windows PC** with Node 20+, pnpm, and Rust installed:

```bash
pnpm install
pnpm installer:suite
```

Output path:

```
apps/launcher/src-tauri/target/release/bundle/nsis/POPS-Launcher_0.1.0_x64-setup.exe
```

### Option C — Download from GitHub Actions (developers on Mac/Linux)

1. Push the repo to GitHub.
2. Open **Actions** → **Build Windows Installer** → **Run workflow**.
3. Edition: `suite` (or `restaurant` / `pharmacy` / `general-store`).
4. API URL: your hosted Railway API (e.g. `https://platformapi-production-39aa.up.railway.app`).
5. When the job finishes, download the artifact **`windows-suite-installer`** (or the matching edition name).

---

## Step 2 — Run the setup file

### 2.1 Locate the file

After download, the file is usually in your **Downloads** folder:

```
C:\Users\<YourName>\Downloads\POPS-Launcher_0.1.0_x64-setup.exe
```

### 2.2 Windows SmartScreen warning

Windows may show **“Windows protected your PC”** for apps that are not yet widely signed.

1. Click **More info**.
2. Click **Run anyway**.

This is normal for in-house or newly built installers.

### 2.3 Start the installer

1. **Double-click** the `*-setup.exe` file.
2. If prompted by User Account Control, click **Yes** (only if your organization requires it; per-user install often does not need elevation).

---

## Step 3 — Installation wizard

Follow the on-screen steps:

| Step | What you see | What to do |
| --- | --- | --- |
| **Welcome** | Installer welcome screen | Click **Next** |
| **Choose location** | Install folder (default is fine) | Click **Next** (or change folder if needed) |
| **Installing** | Progress bar | Wait until files are copied |
| **Finish** | Completion screen with options | See below |

### Finish screen options

On the last screen you will typically see:

- **Run POPS Launcher** (or the product name for your edition) — checked by default. Leave checked to open the app immediately after install.
- **Create desktop shortcut** — checked by default. Creates a shortcut on your desktop.

Click **Finish**.

---

## Step 4 — Where the app is installed

After installation, files are placed in your user profile (no system-wide admin install):

```
C:\Users\<YourName>\AppData\Local\POPS Launcher\
```

(For single-system editions, the folder name matches the product, e.g. `Restaurant Management System`.)

Shortcuts are created at:

| Location | Name |
| --- | --- |
| **Desktop** | `POPS Launcher` (or your edition name) |
| **Start menu** | `POPS Launcher` under the Start menu programs list |

To open the install folder quickly:

1. Press `Win + R`.
2. Type `%LOCALAPPDATA%` and press Enter.
3. Open the `POPS Launcher` (or edition) folder.

---

## Step 5 — Launch the app

You can start the launcher in any of these ways:

1. **Desktop shortcut** — double-click **POPS Launcher** on the desktop.
2. **Start menu** — search for **POPS Launcher** and click it.
3. **Run dialog** — `Win + R`, then browse to the install folder and run `POPS Launcher.exe`.

The app window opens at **1280×800** with the title **POPS Launcher**.

---

## Step 6 — First login and setup

The installed app connects to the **hosted API** that was configured when the installer was built (your Railway backend). You do not enter the API URL during install.

### Default admin login (if seeded on the server)

| Field | Value |
| --- | --- |
| Email | `admin@platform.local` |
| Password | `changeme-please-01` |

> Your organization may use different credentials. Ask your administrator.

### After login

1. **Suite edition** — choose your business system (Restaurant, Pharmacy, or General Store) if multiple are available.
2. **Single-system edition** — goes directly to that system’s login flow.
3. **Select branch** — pick the branch you work in.
4. **Dashboard** — use POS, inventory, HR, and other modules as permitted by your role.

---

## Installer editions — what each one does

| Edition | Best for | Behavior after install |
| --- | --- | --- |
| **Suite** | HQ or multi-business sites | System picker at startup; all three systems in one app |
| **Restaurant** | Restaurants only | Opens straight into restaurant modules; no pharmacy/store UI |
| **Pharmacy** | Pharmacies only | Opens straight into pharmacy modules |
| **General Store** | Retail stores only | Opens straight into store modules |

You can install **more than one** single-system edition side by side (separate shortcuts and install folders).

---

## Uninstall

### Method 1 — Windows Settings

1. Open **Settings** → **Apps** → **Installed apps** (or **Apps & features** on Windows 10).
2. Search for **POPS Launcher** (or your edition name).
3. Click the **⋮** menu → **Uninstall**.
4. Follow the prompts.

### Method 2 — Start menu

1. Open **Start** → find **POPS Launcher**.
2. Right-click → **Uninstall**.

Uninstall removes the app, shortcuts, and registry entries created by the installer. Local SQLite/offline data in the app data folder may remain until manually deleted.

---

## Update or reinstall

To upgrade to a newer version:

1. Download the new `*-setup.exe`.
2. Run it on the same PC (you do not need to uninstall first in most cases).
3. The installer updates files in place and refreshes shortcuts.

To switch from a **single-system** edition to **all systems**, install the **Suite** (`POPS-Launcher_*_x64-setup.exe`) build.

---

## Troubleshooting

### “Windows protected your PC” / installer won’t run

- Click **More info** → **Run anyway**, or ask IT to allowlist the file.

### Installer runs but app does not open

1. Install [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
2. Restart the PC and try the desktop shortcut again.

### Login fails / “Network error” / blank screen after login

The desktop app must reach your hosted API. Confirm:

1. This PC has internet access.
2. The API is online (ask your admin to check Railway or your server).
3. Railway `CORS_ORIGINS` includes `tauri://localhost` (admin/server setting).

### “Invalid credentials”

- Use credentials provided by your admin, not demo accounts unless those are enabled on your server.

### Antivirus blocks the installer

- Add an exception for the setup file or install folder, or contact IT.

### SmartScreen / unknown publisher

- Expected for custom-built installers. Use **Run anyway** or request a code-signed build from your vendor.

### Need the exact setup path on a build machine

```
<project-root>\apps\launcher\src-tauri\target\release\bundle\nsis\POPS-Launcher_0.1.0_x64-setup.exe
```

---

## Quick reference

| Task | Action |
| --- | --- |
| Install | Double-click `*-setup.exe` → Next → Install → Finish |
| Open app | Desktop shortcut or Start menu → **POPS Launcher** |
| Install location | `%LOCALAPPDATA%\POPS Launcher\` |
| Uninstall | Settings → Apps → POPS Launcher → Uninstall |
| Reinstall / update | Run a newer `*-setup.exe` |
| API / backend | Configured at build time; no user setup during install |

---

## Related documentation

- [INSTALLER.md](./INSTALLER.md) — how installers are built (developers)
- [../../README.md](../../README.md) — project overview and commands
- [../../backend/RAILWAY.md](../../backend/RAILWAY.md) — hosting the API on Railway
