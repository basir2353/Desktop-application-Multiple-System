import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
if (edition !== "suite") {
  const configPath = join(tauriDir, `tauri.${edition}.conf.json`);
  if (!existsSync(configPath)) {
    console.error(`[build-edition] Missing config: ${configPath}`);
    process.exit(1);
  }
  args.push("--config", configPath);
}
args.push(...extraArgs);

console.log(`[build-edition] Building "${edition}" installer…`);

// PLATFORM_EDITION flows into the Vite build via tauri's beforeBuildCommand.
const result = spawnSync("pnpm", args, {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
  env: { ...process.env, PLATFORM_EDITION: edition },
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
