#!/usr/bin/env node
/**
 * After APK build, write latest-{admin|staff}.json for GitHub Releases auto-update.
 *
 * Usage:
 *   node scripts/write-mobile-update-manifest.mjs <admin|staff> [version] [versionCode]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const variant = (process.argv[2] ?? "").trim();
if (variant !== "admin" && variant !== "staff") {
  console.error("Usage: node scripts/write-mobile-update-manifest.mjs <admin|staff> [version] [versionCode]");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(__dirname, ".."));
/** Prefer the real git monorepo (build may run from D:\pops short path). */
function resolveRepoRoot() {
  const fromEnv = process.env.POPS_REPO_ROOT?.trim();
  if (fromEnv) return resolve(fromEnv);
  let cur = appRoot;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(cur, "local", "build-fast.bat"))) return cur;
    const parent = resolve(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return resolve(join(appRoot, "..", ".."));
}
const repoRoot = resolveRepoRoot();
const apkName = variant === "admin" ? "pops-admin-release.apk" : "pops-staff-release.apk";
const apkPath = join(appRoot, "dist", apkName);
if (!existsSync(apkPath)) {
  console.error(`[write-mobile-update-manifest] Missing APK: ${apkPath}`);
  process.exit(1);
}

const appJson = JSON.parse(readFileSync(join(appRoot, "app.json"), "utf8"));
const version = (process.argv[3] ?? appJson.expo?.version ?? "1.0.0").trim();
const versionCode = Number(
  process.argv[4] ?? appJson.expo?.android?.versionCode ?? 0,
);

const repo = "basir2353/pops-mobile-updates";
const tag = `mobile-v${version}`;
const url = `https://github.com/${repo}/releases/download/${tag}/${apkName}`;

const manifest = {
  version,
  versionCode,
  notes: `POPS ${variant} ${version} — auto-update`,
  pub_date: new Date().toISOString(),
  url,
};

const outRoot = join(repoRoot, "dist-installers", "mobile-updates");
const releaseDir = join(outRoot, tag);
mkdirSync(releaseDir, { recursive: true });

const manifestName = `latest-${variant}.json`;
writeFileSync(join(outRoot, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(releaseDir, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(apkPath, join(releaseDir, apkName));
copyFileSync(apkPath, join(outRoot, apkName));

console.log(`[write-mobile-update-manifest] ${manifestName}`);
console.log(`  version: ${version} (code ${versionCode})`);
console.log(`  url:     ${url}`);
console.log(`  release: ${releaseDir}`);
