/**
 * Sync shared packages FROM monorepo root packages/* INTO backend-desktop/packages/*.
 * backend-desktop/api is the source of truth for the Nest API (do not overwrite from a removed backend/).
 *
 * Run from backend-desktop/:
 *   node scripts/sync-from-monorepo.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const standaloneRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const monorepoRoot = join(standaloneRoot, "..");

const SKIP_DIR_NAMES = new Set(["node_modules", "dist", ".turbo", "data"]);

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
  [join(monorepoRoot, "packages", "contracts"), join(standaloneRoot, "packages", "contracts")],
  [join(monorepoRoot, "packages", "database-pg"), join(standaloneRoot, "packages", "database-pg")],
  [join(monorepoRoot, "packages", "config"), join(standaloneRoot, "packages", "config")],
];

for (const [src, dest] of copies) {
  copyTree(src, dest);
}

const resolveWorkspace = join(standaloneRoot, "api", "scripts", "resolve-workspace.mjs");
if (existsSync(resolveWorkspace)) {
  const text = readFileSync(resolveWorkspace, "utf8");
  if (!text.includes("standalone")) {
    console.warn("[sync] resolve-workspace.mjs may need standalone paths — check api/scripts/");
  }
}

console.log("[sync] Done. API source of truth remains backend-desktop/api.");
