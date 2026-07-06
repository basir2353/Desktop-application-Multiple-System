import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const launcherRoot = join(__dirname, "..");
const iconsDir = join(launcherRoot, "src-tauri", "icons");
const marker = join(iconsDir, "32x32.png");

if (existsSync(marker)) {
  process.exit(0);
}

const source = join(launcherRoot, "app-icon.svg");
if (!existsSync(source)) {
  console.error("[ensure-icons] Missing app-icon.svg");
  process.exit(1);
}

console.log("[ensure-icons] Generating Tauri icon set…");
const result = spawnSync(
  "pnpm",
  ["exec", "tauri", "icon", source, "-o", iconsDir],
  { cwd: launcherRoot, stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
