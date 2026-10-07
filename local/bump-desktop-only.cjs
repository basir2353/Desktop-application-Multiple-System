const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = [
  "apps/launcher/package.json",
  "apps/launcher/src-tauri/tauri.conf.json",
  "apps/launcher/src-tauri/tauri.suite.conf.json",
  "apps/launcher/src-tauri/tauri.restaurant.conf.json",
  "apps/launcher/src-tauri/tauri.pharmacy.conf.json",
  "apps/launcher/src-tauri/tauri.general-store.conf.json",
];

function bumpPatch(version) {
  const parts = String(version).trim().split(".").map((n) => Number(n) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join(".");
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/launcher/package.json"), "utf8"));
const oldVer = pkg.version;
const newVer = bumpPatch(oldVer);

for (const rel of files) {
  const full = path.join(root, rel);
  const text = fs.readFileSync(full, "utf8");
  if (!text.includes(`"${oldVer}"`)) {
    console.error(`Version ${oldVer} not found in ${rel}`);
    process.exit(1);
  }
  fs.writeFileSync(full, text.replaceAll(`"${oldVer}"`, `"${newVer}"`));
}

console.log(JSON.stringify({ desktop: newVer, from: oldVer }, null, 2));
