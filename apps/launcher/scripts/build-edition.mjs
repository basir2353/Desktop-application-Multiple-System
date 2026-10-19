import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLiveApiUrl } from "../../../local/live-api-url.mjs";

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
 * Fail fast if tauri.conf pubkey ≠ pops-updater.key.pub.
 * Mismatch causes clients to show: "signature was created with a different key".
 */
function assertUpdaterPubkeyMatchesPrivateKey() {
  const confPath = join(tauriDir, "tauri.conf.json");
  const conf = JSON.parse(readFileSync(confPath, "utf8"));
  const bundled = String(conf?.plugins?.updater?.pubkey ?? "").replace(/\s+/g, "");
  if (!bundled) {
    console.error("[build-edition] Missing plugins.updater.pubkey in tauri.conf.json");
    process.exit(1);
  }

  const keyPath = (process.env.TAURI_SIGNING_PRIVATE_KEY_PATH ?? "").trim();
  const pubPath = keyPath ? `${keyPath}.pub` : "";
  if (!pubPath || !existsSync(pubPath)) {
    console.warn(
      "[build-edition] Skipping pubkey check — no .pub next to TAURI_SIGNING_PRIVATE_KEY_PATH",
    );
    return;
  }

  const diskPub = readFileSync(pubPath, "utf8").replace(/\s+/g, "");
  if (diskPub !== bundled) {
    const decodeId = (b64) => {
      try {
        const text = Buffer.from(b64, "base64").toString("utf8");
        const m = text.match(/minisign public key:\s*([0-9A-Fa-f]+)/i);
        return m?.[1] ?? "?";
      } catch {
        return "?";
      }
    };
    console.error(
      "[build-edition] FATAL: updater pubkey mismatch.\n" +
        `  tauri.conf.json pubkey id: ${decodeId(bundled)}\n` +
        `  ${pubPath} id:             ${decodeId(diskPub)}\n` +
        "  Fix: set plugins.updater.pubkey to the contents of pops-updater.key.pub\n" +
        '  (otherwise clients get "signature was created with a different key").',
    );
    process.exit(1);
  }
  console.log("[build-edition] Updater pubkey matches signing key.pub ✓");
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
const tauriDir = join(__dirname, "..", "src-tauri");

const LIVE = readLiveApiUrl();

function resolveApiUrl() {
  const fromEnv = (process.env.VITE_API_BASE_URL ?? "").trim();
  if (fromEnv) return fromEnv;
  return LIVE;
}

const VALID = new Set(["restaurant", "general-store", "pharmacy", "tradeflow", "mobizone", "suite"]);

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
process.env.VITE_API_BASE_URL = apiUrl;
if (!apiUrl) {
  console.error(
    "[build-edition] VITE_API_BASE_URL is required.\n" +
      "Set it in the repo-root .env to your hosted API (e.g. https://backend-desktop-production-600b.up.railway.app).",
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

assertUpdaterPubkeyMatchesPrivateKey();

console.log(`[build-edition] Building "${edition}" installer (API: ${apiUrl})…`);

// PLATFORM_EDITION flows into the Vite build via tauri's beforeBuildCommand.
const result = spawnSync("pnpm", args, {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
  env: withSigningEnv({
    ...process.env,
    PLATFORM_EDITION: edition,
    VITE_API_BASE_URL: apiUrl,
  }),
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
