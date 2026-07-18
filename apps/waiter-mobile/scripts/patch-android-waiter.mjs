import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "android");
const bg = join(android, "app", "build.gradle");
const gp = join(android, "gradle.properties");

let t = readFileSync(bg, "utf8");
if (!/^\s*hermesFlags\s*=/m.test(t)) {
  t = t.replace(
    /bundleCommand = "export:embed"\n/,
    'bundleCommand = "export:embed"\n    hermesFlags = ["-O"]\n',
  );
}
t = t.replace(/applicationId\s+'[^']+'/, "applicationId 'com.platform.pops.waiter'");
if (!t.includes("def appRoot = rootDir.getAbsoluteFile().getParentFile()")) {
  t = t.replace(
    /def projectRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getAbsolutePath\(\)\n/,
    "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\ndef appRoot = rootDir.getAbsoluteFile().getParentFile()\n",
  );
}
if (!t.includes('entryFile = file("../../index.js")')) {
  t = t.replace(/\nreact \{\n/, '\nreact {\n    root = appRoot\n    entryFile = file("../../index.js")\n');
}
writeFileSync(bg, t);

// Force install/home-screen label to Waiter (stale rider prebuild can leave "POPS Rider").
const stringsPath = join(android, "app", "src", "main", "res", "values", "strings.xml");
if (existsSync(stringsPath)) {
  let strings = readFileSync(stringsPath, "utf8");
  strings = strings.replace(
    /<string name="app_name">[^<]*<\/string>/,
    '<string name="app_name">POPS Waiter</string>',
  );
  writeFileSync(stringsPath, strings);
}
const settingsPath = join(android, "settings.gradle");
if (existsSync(settingsPath)) {
  let settings = readFileSync(settingsPath, "utf8");
  settings = settings.replace(/rootProject\.name\s*=\s*'[^']*'/, "rootProject.name = 'POPS Waiter'");
  writeFileSync(settingsPath, settings);
}
// Stale rider prebuild can leave rider deep-link schemes in the manifest.
const manifestPath = join(android, "app", "src", "main", "AndroidManifest.xml");
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, "utf8");
  manifest = manifest
    .replaceAll("pops-rider", "pops-waiter")
    .replaceAll("com.platform.pops.rider", "com.platform.pops.waiter");
  writeFileSync(manifestPath, manifest);
}

let g = readFileSync(gp, "utf8");
g = g.replace(/^reactNativeArchitectures=.*$/m, "reactNativeArchitectures=arm64-v8a");
if (!/^reactNativeArchitectures=/m.test(g)) g = `${g.trimEnd()}\nreactNativeArchitectures=arm64-v8a\n`;
const jvmArgs = "org.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8";
if (/^org\.gradle\.jvmargs=/m.test(g)) {
  g = g.replace(/^org\.gradle\.jvmargs=.*$/m, jvmArgs);
} else {
  g = `${g.trimEnd()}\n${jvmArgs}\n`;
}
// Avoid CI/single-use daemon surprises when building locally
g = g.replace(/^org\.gradle\.daemon=.*$/m, "org.gradle.daemon=true");
if (!/^org\.gradle\.daemon=/m.test(g)) g = `${g.trimEnd()}\norg.gradle.daemon=true\n`;
writeFileSync(gp, g);

const xmlDir = join(android, "app", "src", "main", "res", "xml");
mkdirSync(xmlDir, { recursive: true });
const srcXml = join(root, "node_modules", "expo-secure-store", "android", "src", "main", "res", "xml");
for (const name of ["secure_store_backup_rules.xml", "secure_store_data_extraction_rules.xml"]) {
  const from = join(srcXml, name);
  if (existsSync(from)) copyFileSync(from, join(xmlDir, name));
}

mkdirSync(join(android, "app", "build", "intermediates", "sourcemaps", "react", "release"), {
  recursive: true,
});
mkdirSync(join(android, "app", "build", "generated", "assets", "createBundleReleaseJsAndAssets"), {
  recursive: true,
});

console.log("patched ok");

