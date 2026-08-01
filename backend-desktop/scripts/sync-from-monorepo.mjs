/**
 * Copy API + shared packages from the main monorepo into backend-desktop/.
 *
 * Run from backend-desktop/ after changing backend/api or packages/* in the full repo.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const standaloneRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const monorepoRoot = join(standaloneRoot, "..");

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".turbo",
  "data",
]);

function copyTree(src, dest) {
  if (!existsSync(src)) {
    console.warn(`[sync] Skip missing: ${src}`);
    return;
  }
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  cpSync(src, dest, {
    recursive: true,
    filter: (sourcePath) => {
      const parts = sourcePath.split(/[/\\]/);
      return !parts.some((part) => SKIP_DIR_NAMES.has(part));
    },
  });
  console.log(`[sync] ${basename(src)} → ${dest}`);
}

const copies = [
  [join(monorepoRoot, "backend", "api", "src"), join(standaloneRoot, "api", "src")],
  [join(monorepoRoot, "backend", "api", "scripts"), join(standaloneRoot, "api", "scripts")],
  [join(monorepoRoot, "packages", "contracts"), join(standaloneRoot, "packages", "contracts")],
  [join(monorepoRoot, "packages", "database-pg"), join(standaloneRoot, "packages", "database-pg")],
  [join(monorepoRoot, "packages", "config"), join(standaloneRoot, "packages", "config")],
];

for (const [src, dest] of copies) {
  copyTree(src, dest);
}

// Preserve standalone-specific start script if monorepo copy overwrote resolve-workspace
const startScript = join(standaloneRoot, "api", "scripts", "start-railway.mjs");
if (existsSync(startScript)) {
  const text = readFileSync(startScript, "utf8");
  if (!text.includes("resolve-workspace.mjs")) {
    console.warn("[sync] Warning: start-railway.mjs may need resolve-workspace import — check api/scripts/");
  }
}

console.log("[sync] Standalone backend-desktop is up to date with monorepo.");
