import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * After a signed Tauri build, write latest-{edition}.json for GitHub Releases.
 *
 * Usage:
 *   node scripts/write-update-manifest.mjs <edition> [version]
 *
 * Env:
 *   CARGO_TARGET_DIR — defaults to %TEMP%/pops-launcher-cargo-target
 *   UPDATE_DOWNLOAD_BASE — GitHub release asset base URL (no trailing slash)
 */

const edition = (process.argv[2] ?? "").trim();
const versionArg = (process.argv[3] ?? "").trim();
const VALID = new Set(["suite", "restaurant", "general-store", "pharmacy"]);
if (!VALID.has(edition)) {
  console.error(`Usage: node scripts/write-update-manifest.mjs <${[...VALID].join("|")}> [version]`);
  process.exit(1);
}

const cargoTarget =
  process.env.CARGO_TARGET_DIR?.trim() ||
  join(process.env.TEMP || process.env.TMP || "/tmp", "pops-launcher-cargo-target");
const nsisDir = join(cargoTarget, "release", "bundle", "nsis");
if (!existsSync(nsisDir)) {
  console.error(`[write-update-manifest] Missing NSIS dir: ${nsisDir}`);
  process.exit(1);
}

const setupFiles = readdirSync(nsisDir).filter((f) => f.endsWith("-setup.exe"));
if (setupFiles.length === 0) {
  console.error(`[write-update-manifest] No *-setup.exe in ${nsisDir}`);
  process.exit(1);
}

// Prefer the newest matching installer for this edition's product name.
const productHints = {
  suite: /universal/i,
  restaurant: /restaurant/i,
  "general-store": /general\s*store|retail/i,
  pharmacy: /pharmacy/i,
};
const hint = productHints[edition];
function versionTuple(name) {
  const m = name.match(/_(\d+)\.(\d+)\.(\d+)_/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const ranked = setupFiles
  .filter((f) => hint.test(f))
  .sort((a, b) => {
    const va = versionTuple(a);
    const vb = versionTuple(b);
    for (let i = 0; i < 3; i++) {
      if (vb[i] !== va[i]) return vb[i] - va[i];
    }
    // Same version: newest file wins.
    try {
      return statSync(join(nsisDir, b)).mtimeMs - statSync(join(nsisDir, a)).mtimeMs;
    } catch {
      return b.localeCompare(a);
    }
  });
const setupName = ranked[0] ?? setupFiles.sort().at(-1);
const setupPath = join(nsisDir, setupName);
const sigPath = `${setupPath}.sig`;
if (!existsSync(sigPath)) {
  console.error(
    `[write-update-manifest] Missing signature: ${sigPath}\n` +
      "Build with TAURI_SIGNING_PRIVATE_KEY(_PATH) and createUpdaterArtifacts=true.",
  );
  process.exit(1);
}

const version =
  versionArg ||
  setupName.match(/_(\d+\.\d+\.\d+)_/)?.[1] ||
  "0.0.0";

const safeAsset = setupName.replace(/\s+/g, "-");
const repo = "basir2353/pops-desktop-updates";
const base =
  (process.env.UPDATE_DOWNLOAD_BASE ?? "").trim().replace(/\/$/, "") ||
  `https://github.com/${repo}/releases/download/desktop-v${version}`;

const signature = readFileSync(sigPath, "utf8").trim();
const manifest = {
  version,
  notes: `Desktop ${edition} update ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `${base}/${safeAsset}`,
    },
  },
};

const outDir = join(
  process.cwd(),
  "..",
  "..",
  "dist-installers",
  "updates",
);
mkdirSync(outDir, { recursive: true });

const manifestName = `latest-${edition}.json`;
const manifestPath = join(outDir, manifestName);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const releaseDir = join(outDir, `desktop-v${version}`);
mkdirSync(releaseDir, { recursive: true });
copyFileSync(setupPath, join(releaseDir, safeAsset));
copyFileSync(sigPath, join(releaseDir, `${safeAsset}.sig`));
copyFileSync(manifestPath, join(releaseDir, manifestName));
// Also keep copies at updates/ root for convenience
copyFileSync(setupPath, join(outDir, safeAsset));
copyFileSync(sigPath, join(outDir, `${safeAsset}.sig`));

console.log(`[write-update-manifest] ${manifestName}`);
console.log(`  version: ${version}`);
console.log(`  url:     ${manifest.platforms["windows-x86_64"].url}`);
console.log(`  out:     ${manifestPath}`);
console.log(`  release: ${releaseDir}`);
