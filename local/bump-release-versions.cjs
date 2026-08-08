const fs = require("fs");

const desktopFiles = [
  "apps/launcher/package.json",
  "apps/launcher/src-tauri/tauri.conf.json",
  "apps/launcher/src-tauri/tauri.suite.conf.json",
  "apps/launcher/src-tauri/tauri.restaurant.conf.json",
  "apps/launcher/src-tauri/tauri.pharmacy.conf.json",
  "apps/launcher/src-tauri/tauri.general-store.conf.json",
];

for (const f of desktopFiles) {
  const s = fs.readFileSync(f, "utf8").replaceAll('"version": "0.3.29"', '"version": "0.3.30"');
  fs.writeFileSync(f, s);
}

fs.writeFileSync(
  "apps/waiter-mobile/package.json",
  fs.readFileSync("apps/waiter-mobile/package.json", "utf8").replaceAll('"version": "1.1.27"', '"version": "1.1.28"'),
);

fs.writeFileSync(
  "apps/waiter-mobile/app.json",
  fs
    .readFileSync("apps/waiter-mobile/app.json", "utf8")
    .replaceAll('"version": "1.1.27"', '"version": "1.1.28"')
    .replaceAll('"versionCode": 1127', '"versionCode": 1128'),
);

console.log("desktop", JSON.parse(fs.readFileSync("apps/launcher/package.json", "utf8")).version);
console.log("mobile", JSON.parse(fs.readFileSync("apps/waiter-mobile/package.json", "utf8")).version);
console.log("app.json", JSON.parse(fs.readFileSync("apps/waiter-mobile/app.json", "utf8")).expo.version, JSON.parse(fs.readFileSync("apps/waiter-mobile/app.json", "utf8")).expo.android.versionCode);
