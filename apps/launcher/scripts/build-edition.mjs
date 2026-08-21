import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Ensure Tauri updater signing key is in env (PATH var alone is unreliable on Windows). */
function withSigningEnv(baseEnv) {
  const env = { ...baseEnv };
  if (!(env.TAURI_SIGNING_PRIVATE_KEY ?? "").trim()) {
    const keyPath = (env.TAURI_SIGNING_PRIVATE_KEY_PATH ?? "").trim();
    if (keyPath && existsSync(keyPath)) {
      env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, "utf8");
    }
  }
  // Empty password keys still prompt unless this is set explicitly.
  if (env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined) {
    env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "";
  }
  return env;
}

/**
 * Builds a single-system desktop installer.
 *
 * Usage:
 *   node scripts/build-edition.mjs <restaurant|general-store|pharmacy|suite>
 *
 * Each edition:
 *   - bakes PLATFORM_EDITION into the web bundle (only that system's UI ships)
 *   - applies src-tauri/tauri.<edition>.conf.json (product name, id, shortcut)
 *   - emits its own installer (.exe / .msi / .dmg / .AppImage)
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..", "..");
const tauriDir = join(__dirname, "..", "src-tauri");

const OLD = "https://backend-desktop-production-5505.up.railway.app";
const NEW = "https://backend-desktop-production-600b.up.railway.app";
const liveEnvPath = join(repoRoot, "local", "live-env.json");

function readLiveEnvFile() {
  try {
    if (existsSync(liveEnvPath)) {
      const parsed = JSON.parse(readFileSync(liveEnvPath, "utf8"));
      return parsed.active === "new" ? "new" : "old";
    }
  } catch {
    // fall through
  }
  return "old";
}

function resolveApiUrl() {
  const fromEnv = (process.env.VITE_API_BASE_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  return readLiveEnvFile() === "new" ? NEW : OLD;
}

function resolveLiveEnv(apiUrl) {
  const fromEnv = (process.env.VITE_LIVE_ENV ?? "").trim();
  if (fromEnv === "new" || fromEnv === "old") return fromEnv;
  if (apiUrl.includes("600b")) return "new";
  if (apiUrl.includes("5505")) return "old";
  return readLiveEnvFile();
}

const VALID = new Set(["restaurant", "general-store", "pharmacy", "suite"]);

const edition = (process.argv[2] ?? "").trim();
if (!VALID.has(edition)) {
  console.error(
    `[build-edition] Unknown edition "${edition}".\n` +
      `Valid: ${[...VALID].join(", ")}`,
  );
  process.exit(1);
}

const extraArgs = process.argv.slice(3);

const args = ["exec", "tauri", "build"];
{
  const configPath = join(tauriDir, `tauri.${edition}.conf.json`);
  // Suite uses tauri.suite.conf.json; single editions use their own overlay.
  // Fall back to base tauri.conf.json only if the edition overlay is missing.
  if (existsSync(configPath)) {
    const configArg =
      process.platform === "win32" && /\s/.test(configPath) ? `"${configPath}"` : configPath;
    args.push("--config", configArg);
  } else if (edition !== "suite") {
    console.error(`[build-edition] Missing config: ${configPath}`);
    process.exit(1);
  }
}
args.push(...extraArgs);

const apiUrl = resolveApiUrl();
const liveEnv = resolveLiveEnv(apiUrl);
process.env.VITE_API_BASE_URL = apiUrl;
process.env.VITE_LIVE_ENV = liveEnv;
if (!apiUrl) {
  console.error(
    "[build-edition] VITE_API_BASE_URL is required.\n" +
      "Set it in the repo-root .env to your hosted API (e.g. https://your-api.up.railway.app).",
  );
  process.exit(1);
}
if (/localhost|127\.0\.0\.1/.test(apiUrl)) {
  console.warn(
    `[build-edition] Warning: VITE_API_BASE_URL points at local dev (${apiUrl}). ` +
      "Production installers should use your hosted Railway API.",
  );
}

const icons = spawnSync("node", ["./scripts/ensure-icons.mjs"], {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
});
if (icons.status !== 0) {
  process.exit(icons.status ?? 1);
}

console.log(`[build-edition] Building "${edition}" installer (API: ${apiUrl}, live: ${liveEnv})…`);

// PLATFORM_EDITION flows into the Vite build via tauri's beforeBuildCommand.
const result = spawnSync("pnpm", args, {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
  env: withSigningEnv({
    ...process.env,
    PLATFORM_EDITION: edition,
    VITE_API_BASE_URL: apiUrl,
    VITE_LIVE_ENV: liveEnv,
  }),
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
