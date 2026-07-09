#!/usr/bin/env node
/**
 * Build the Windows .exe installer for POPS Launcher (suite edition).
 *
 * - On Windows: runs Tauri NSIS build locally → *-setup.exe
 * - On macOS/Linux: prints how to build via GitHub Actions
 *
 * Requires VITE_API_BASE_URL in repo-root .env (your hosted Railway API).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const launcherRoot = join(__dirname, "..");
const repoRoot = join(launcherRoot, "..", "..");

function loadEnvApiUrl() {
  const envPath = join(repoRoot, ".env");
  if (!existsSync(envPath)) return process.env.VITE_API_BASE_URL?.trim() ?? "";
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(/^VITE_API_BASE_URL=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return process.env.VITE_API_BASE_URL?.trim() ?? "";
}

const apiUrl = loadEnvApiUrl();
if (!apiUrl) {
  console.error(
    "[installer] Set VITE_API_BASE_URL in the repo-root .env before building.\n" +
      "Example: VITE_API_BASE_URL=https://platformapi-production-39aa.up.railway.app",
  );
  process.exit(1);
}

if (process.platform !== "win32") {
  console.log(`
Windows .exe installers must be built on Windows (or via GitHub Actions).

Option A — GitHub Actions (recommended from Mac/Linux):
  1. Push your code to GitHub
  2. Open: Actions → "Build Windows Installer" → Run workflow
  3. Edition: suite
  4. API URL: ${apiUrl}
  5. Download the .exe from Artifacts when the job finishes

Option B — Build on a Windows PC:
  pnpm install
  pnpm installer:windows

Output file (after install, user double-clicks desktop shortcut):
  apps/launcher/src-tauri/target/release/bundle/nsis/POPS-Launcher_*_x64-setup.exe
`);
  process.exit(0);
}

console.log(`[installer] Building POPS Launcher Windows setup (API: ${apiUrl})…`);
const result = spawnSync("node", ["./scripts/build-edition.mjs", "suite"], {
  cwd: launcherRoot,
  stdio: "inherit",
  env: { ...process.env, VITE_API_BASE_URL: apiUrl },
  shell: true,
});
process.exit(result.status ?? 1);
