const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function writeJson(rel, data) {
  fs.writeFileSync(path.join(root, rel), `${JSON.stringify(data, null, 2)}\n`);
}

function bumpPatch(version) {
  const parts = String(version).trim().split(".").map((n) => Number(n) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join(".");
}

function replaceVersionInFile(rel, oldVer, newVer) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  if (!text.includes(`"${oldVer}"`)) return;
  fs.writeFileSync(full, text.replaceAll(`"${oldVer}"`, `"${newVer}"`));
}

const launcherPkg = readJson("apps/launcher/package.json");
const mobilePkg = readJson("apps/waiter-mobile/package.json");
const appJson = readJson("apps/waiter-mobile/app.json");

const oldDesktop = launcherPkg.version;
const newDesktop = bumpPatch(oldDesktop);
const oldMobile = mobilePkg.version;
const newMobile = bumpPatch(oldMobile);
const oldCode = Number(appJson.expo?.android?.versionCode ?? 1100);
const newCode = oldCode + 1;

const desktopFiles = [
  "apps/launcher/package.json",
  "apps/launcher/src-tauri/tauri.conf.json",
  "apps/launcher/src-tauri/tauri.suite.conf.json",
  "apps/launcher/src-tauri/tauri.restaurant.conf.json",
  "apps/launcher/src-tauri/tauri.pharmacy.conf.json",
  "apps/launcher/src-tauri/tauri.general-store.conf.json",
];

for (const rel of desktopFiles) {
  replaceVersionInFile(rel, oldDesktop, newDesktop);
}

replaceVersionInFile("apps/waiter-mobile/package.json", oldMobile, newMobile);
replaceVersionInFile("apps/waiter-mobile/app.json", oldMobile, newMobile);

const appJsonPath = path.join(root, "apps/waiter-mobile/app.json");
const appRaw = fs.readFileSync(appJsonPath, "utf8");
fs.writeFileSync(
  appJsonPath,
  appRaw.replace(`"versionCode": ${oldCode}`, `"versionCode": ${newCode}`),
);

console.log(JSON.stringify({ desktop: newDesktop, mobile: newMobile, versionCode: newCode }, null, 2));
