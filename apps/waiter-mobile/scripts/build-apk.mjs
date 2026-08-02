#!/usr/bin/env node
/**
 * Build a release APK on Windows (or any OS with Java + Android SDK).
 *
 * Usage:
 *   pnpm build:apk:win            # staff APK (Waiter + Rider) — default
 *   pnpm build:apk:win staff
 *   pnpm build:apk:win admin
 *   pnpm build:apk:win waiter     # legacy single-role
 *   pnpm build:apk:win rider      # legacy single-role
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VARIANTS = {
  staff: {
    apkName: "pops-staff-release.apk",
    packageId: "com.platform.pops.staff",
    envVariant: "staff",
    displayName: "POPS Staff",
  },
  admin: {
    apkName: "pops-admin-release.apk",
    packageId: "com.platform.pops.admin",
    envVariant: "admin",
    displayName: "POPS Admin",
  },
  waiter: {
    apkName: "pops-waiter-release.apk",
    packageId: "com.platform.pops.waiter",
    envVariant: "waiter",
    displayName: "POPS Waiter",
  },
  rider: {
    apkName: "pops-rider-release.apk",
    packageId: "com.platform.pops.rider",
    envVariant: "rider",
    displayName: "POPS Rider",
  },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(__dirname, ".."));
const androidDir = join(appRoot, "android");
const isWin = process.platform === "win32";

const rawArg = (process.argv[2] ?? "staff").toLowerCase();
const variantArg = Object.prototype.hasOwnProperty.call(VARIANTS, rawArg) ? rawArg : "staff";
const variant = VARIANTS[variantArg];

function resolvePnpmCmd() {
  if (process.env.PNPM_CMD && existsSync(process.env.PNPM_CMD)) return process.env.PNPM_CMD;
  if (isWin) {
    const appData = process.env.APPDATA;
    if (appData) {
      const candidate = join(appData, "npm", "pnpm.cmd");
      if (existsSync(candidate)) return candidate;
    }
  }
  return "pnpm";
}

const pnpmCmd = resolvePnpmCmd();

function run(cmd, args, opts = {}) {
  const useShell = opts.shell ?? isWin;
  const command = useShell && /\s/.test(cmd) ? `"${cmd}"` : cmd;
  const result = spawnSync(command, args, {
    cwd: opts.cwd ?? appRoot,
    stdio: "inherit",
    shell: useShell,
    env: { ...process.env, NODE_ENV: "production", ...opts.env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function loadEnvApiUrl() {
  const envPath = join(appRoot, ".env");
  if (!existsSync(envPath)) {
    console.error("[build-apk] Missing apps/waiter-mobile/.env — copy from .env.example");
    process.exit(1);
  }
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(/^EXPO_PUBLIC_API_BASE_URL=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  console.error("[build-apk] Set EXPO_PUBLIC_API_BASE_URL in apps/waiter-mobile/.env");
  process.exit(1);
}

function resolveBuildPaths() {
  const shortRoots =
    process.env.POPS_SKIP_SHORT_PATH === "1"
      ? []
      : isWin
        ? [
            process.env.POPS_BUILD_ROOT,
            // Prefer same drive as this script (cross-drive junctions break Metro/Gradle).
            `${appRoot.slice(0, 2)}\\pops`,
            "D:\\pops",
            "E:\\pos-build",
            "C:\\pops",
          ].filter(Boolean)
        : [];
  for (const root of shortRoots) {
    const layouts = [
      { appRoot: join(root, "apps", "waiter-mobile"), androidDir: join(root, "apps", "waiter-mobile", "android") },
      { appRoot: root, androidDir: join(root, "android") },
    ];
    for (const layout of layouts) {
      if (!existsSync(join(layout.appRoot, "package.json"))) continue;
      console.log(`[build-apk] Building from ${layout.appRoot} (short path for native CMake)…`);
      return {
        appRoot: layout.appRoot,
        androidDir: layout.androidDir,
        apkSrc: join(layout.androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk"),
      };
    }
  }
  return {
    appRoot,
    androidDir,
    apkSrc: join(androidDir, "app", "build", "outputs", "apk", "release", "app-release.apk"),
  };
}

function readAndroidPackageId(buildGradlePath) {
  if (!existsSync(buildGradlePath)) return null;
  const text = readFileSync(buildGradlePath, "utf8");
  const match = text.match(/applicationId\s+'([^']+)'/);
  return match?.[1] ?? null;
}

function patchGradleProperties(propsPath) {
  const templatePath = join(__dirname, "android-gradle.properties");
  if (!existsSync(templatePath) || !existsSync(propsPath)) return;
  const template = readFileSync(templatePath, "utf8");
  let text = readFileSync(propsPath, "utf8");
  for (const line of template.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const key = trimmed.split("=")[0];
    const value = trimmed.slice(key.length + 1);
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(propsPath, text);
}

function patchAndroidBuildGradle(gradlePath, buildAppRoot) {
  if (!existsSync(gradlePath)) return;
  let text = readFileSync(gradlePath, "utf8");

  if (!text.includes("def appRoot = rootDir.getAbsoluteFile().getParentFile()")) {
    text = text.replace(
      /def projectRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getAbsolutePath\(\)\n/,
      "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\ndef appRoot = rootDir.getAbsoluteFile().getParentFile()\n",
    );
  }

  if (!text.includes('entryFile = file("../../index.js")')) {
    text = text.replace(/\nreact \{\n/, '\nreact {\n    root = appRoot\n    entryFile = file("../../index.js")\n');
    text = text.replace(
      /entryFile = file\(\["node", "-e", "require\('expo\/scripts\/resolveAppEntry'\)".*\n/,
      "",
    );
  }

  // Skip Hermes source maps — compose-source-maps fails on empty Metro maps (Node 24 / export:embed).
  if (!/^\s*hermesFlags\s*=/m.test(text)) {
    text = text.replace(
      /\/\/\s*hermesFlags\s*=\s*\["-O",\s*"-output-source-map"\]/,
      'hermesFlags = ["-O"]',
    );
  }
  if (!/^\s*hermesFlags\s*=/m.test(text) && text.includes('bundleCommand = "export:embed"')) {
    text = text.replace(
      /bundleCommand = "export:embed"\n/,
      'bundleCommand = "export:embed"\n    hermesFlags = ["-O"]\n',
    );
  }

  if (!text.includes("expo.modules.ExpoModulesPackage")) {
    const autolinkPatch = `
// expo-modules-autolinking still emits legacy expo.core.ExpoModulesPackage; Expo 52 uses expo.modules.
tasks.configureEach { task ->
    if (task.name == "generateAutolinkingPackageList") {
        task.doLast {
            def pkgList = file("\${buildDir}/generated/autolinking/src/main/java/com/facebook/react/PackageList.java")
            if (pkgList.exists()) {
                def pkgText = pkgList.getText("UTF-8").replace("expo.core.ExpoModulesPackage", "expo.modules.ExpoModulesPackage")
                pkgList.write(pkgText, "UTF-8")
            }
        }
    }
}
`;
    text = text.replace(/(\n\s+autolinkLibrariesWithApp\(\)\n\})/, `$1${autolinkPatch}`);
  }

  // Drop Metro-emitted ultra-long pnpm asset names that break AAPT on Windows (keep vendor_* shorts).
  if (!text.includes("___desktop_")) {
    const aaptPatch = `
tasks.configureEach { task ->
    if (task.name.contains("merge") && task.name.contains("Resources")) {
        task.doFirst {
            def gen = file("\${projectDir}/build/generated/res")
            if (gen.exists()) {
                gen.eachFileRecurse { f ->
                    if (f.file && f.name.startsWith("___desktop_")) {
                        f.delete()
                    }
                }
            }
        }
    }
}
`;
    text = `${text.trimEnd()}\n${aaptPatch}\n`;
  }

  if (buildAppRoot.includes(" ") && !text.includes("resolveHermesCommand")) {
    const hermesBlock = `
// RN Gradle runs Hermes via \`cmd /c <path>\` without quoting; paths with spaces fail on Windows.
def resolveHermesCommand(File waiterAppRoot) {
    def rnRoot = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, waiterAppRoot).text.trim()).getParentFile()
    def osBin = System.getProperty("os.name").toLowerCase().contains("windows") ? "win64-bin" : "osx-bin"
    def hermesSrc = new File(rnRoot, "sdks/hermesc/\${osBin}/hermesc" + (osBin == "win64-bin" ? ".exe" : ""))
    def cacheDir = new File(System.getenv("LOCALAPPDATA") ?: System.getProperty("user.home"), "pops-build")
    def hermesCache = new File(cacheDir, "hermesc" + (osBin == "win64-bin" ? ".exe" : ""))
    cacheDir.mkdirs()
    if (!hermesCache.exists() || hermesCache.lastModified() < hermesSrc.lastModified()) {
        ant.copy(file: hermesSrc.absolutePath, tofile: hermesCache.absolutePath, overwrite: true)
    }
    return hermesCache.absolutePath
}
`;
    text = text.replace(
      /def appRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\n/,
      `def appRoot = rootDir.getAbsoluteFile().getParentFile()\n${hermesBlock}`,
    );
    text = text.replace(
      /hermesCommand = new File\(\["node".*\n/,
      "    hermesCommand = resolveHermesCommand(appRoot)\n",
    );
  }

  writeFileSync(gradlePath, text);
}

function forceArm64Only(propsPath) {
  if (!existsSync(propsPath)) return;
  let text = readFileSync(propsPath, "utf8");
  text = text.replace(/^reactNativeArchitectures=.*$/m, "reactNativeArchitectures=arm64-v8a");
  if (!/^reactNativeArchitectures=/m.test(text)) {
    text = `${text.trimEnd()}\nreactNativeArchitectures=arm64-v8a\n`;
  }
  // Ensure size-reduction flags survive reused android/ trees.
  const flags = {
    "android.enableProguardInReleaseBuilds": "true",
    "android.enableShrinkResourcesInReleaseBuilds": "true",
    "expo.gif.enabled": "false",
    "expo.webp.enabled": "false",
    "expo.webp.animated": "false",
    "expo.useLegacyPackaging": "true",
  };
  for (const [key, value] of Object.entries(flags)) {
    const pattern = new RegExp(`^${key.replace(/\./g, "\\.")}=.*$`, "m");
    text = pattern.test(text)
      ? text.replace(pattern, `${key}=${value}`)
      : `${text.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(propsPath, text);
}

/** Strip x86 / armeabi from the APK even if Gradle still resolves those AARs. */
function forceArm64AbiFilters(buildGradlePath) {
  if (!existsSync(buildGradlePath)) return;
  let text = readFileSync(buildGradlePath, "utf8");
  let changed = false;

  if (!text.includes('abiFilters "arm64-v8a"') && !text.includes("abiFilters 'arm64-v8a'")) {
    if (/defaultConfig\s*\{/.test(text)) {
      text = text.replace(
        /defaultConfig\s*\{/,
        `defaultConfig {
        ndk {
            abiFilters "arm64-v8a"
        }`,
      );
      changed = true;
    }
  }

  if (!text.includes("**/x86_64/**") && text.includes("packagingOptions")) {
    text = text.replace(
      /packagingOptions\s*\{/,
      `packagingOptions {
        exclude "lib/armeabi-v7a/**"
        exclude "lib/x86/**"
        exclude "lib/x86_64/**"`,
    );
    changed = true;
  } else if (!text.includes("**/x86_64/**") && text.includes("jniLibs")) {
    // RN 0.76 style packagingOptions { jniLibs { ... } }
    if (!text.includes('excludes += ["**/armeabi-v7a/**"')) {
      text = text.replace(
        /jniLibs\s*\{/,
        `jniLibs {
            excludes += ["**/armeabi-v7a/**", "**/x86/**", "**/x86_64/**"]`,
      );
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(buildGradlePath, text);
    console.log("[build-apk] Forced arm64-v8a abiFilters + excluded other ABIs");
  }
}


function ensureAndroidProject(apiUrl, buildPaths) {
  const buildGradle = join(buildPaths.androidDir, "app", "build.gradle");
  const currentPackage = readAndroidPackageId(buildGradle);
  const androidExists = existsSync(buildPaths.androidDir) && existsSync(buildGradle);
  const packageMismatch = androidExists && currentPackage !== variant.packageId;
  // Default ON: reuse android/ + caches. Set POPS_FAST_BUILD=0 for old wipe-on-variant-switch.
  const fastBuild = process.env.POPS_FAST_BUILD !== "0";
  const forcePrebuild = process.env.POPS_FORCE_PREBUILD === "1";

  // Fast path: reuse existing android/ (Gradle + native caches). Patch id + launcher name.
  if (androidExists && !forcePrebuild && (fastBuild || !packageMismatch)) {
    if (packageMismatch) {
      console.log(
        `[build-apk] Fast: reusing android/ — patching ${currentPackage} → ${variant.packageId}`,
      );
      forceApplicationId(buildGradle, variant.packageId);
    } else {
      console.log("[build-apk] Fast: reusing existing android/ (skip prebuild)");
    }
    forceAppDisplayName(buildPaths.androidDir, variant.displayName);
    return;
  }

  const needsPrebuild = !androidExists || packageMismatch;
  if (!needsPrebuild) return;

  // Prefer rename over expo --clean rmdir (Windows often locks android/ mid-build).
  if (existsSync(buildPaths.androidDir)) {
    const stale = `${buildPaths.androidDir}.stale-${Date.now()}`;
    try {
      renameSync(buildPaths.androidDir, stale);
      console.log(`[build-apk] Moved locked android → ${stale}`);
      try {
        rmSync(stale, { recursive: true, force: true });
      } catch {
        /* leave stale dir */
      }
    } catch (err) {
      console.warn(
        "[build-apk] Could not move android dir:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`[build-apk] Running expo prebuild for ${variantArg} (${variant.packageId})…`);
  run(pnpmCmd, ["exec", "expo", "prebuild", "--platform", "android"], {
    cwd: buildPaths.appRoot,
    env: {
      EXPO_PUBLIC_API_BASE_URL: apiUrl,
      EXPO_PUBLIC_APP_VARIANT: variant.envVariant,
      APP_VARIANT: variant.envVariant,
      CI: "1",
    },
  });

  patchAndroidBuildGradle(buildGradle, buildPaths.appRoot);
  patchGradleProperties(join(buildPaths.androidDir, "gradle.properties"));
  forceArm64Only(join(buildPaths.androidDir, "gradle.properties"));
  forceArm64AbiFilters(buildGradle);
  forceApplicationId(buildGradle, variant.packageId);
  forceAppDisplayName(buildPaths.androidDir, variant.displayName);
}

function forceApplicationId(buildGradlePath, packageId) {
  if (!existsSync(buildGradlePath)) return;
  let text = readFileSync(buildGradlePath, "utf8");
  const next = text.replace(/applicationId\s+'[^']+'/, `applicationId '${packageId}'`);
  if (next !== text) {
    writeFileSync(buildGradlePath, next);
    console.log(`[build-apk] Forced applicationId → ${packageId}`);
  }
}

/** Keep launcher label in sync when android/ is reused across variants (Staff vs Admin). */
function forceAppDisplayName(androidDirPath, displayName) {
  const stringsPath = join(androidDirPath, "app", "src", "main", "res", "values", "strings.xml");
  if (!existsSync(stringsPath)) return;
  let text = readFileSync(stringsPath, "utf8");
  const next = text.replace(
    /<string name="app_name">[^<]*<\/string>/,
    `<string name="app_name">${displayName}</string>`,
  );
  if (next !== text) {
    writeFileSync(stringsPath, next);
    console.log(`[build-apk] Forced app_name → ${displayName}`);
  } else if (!text.includes(`>${displayName}<`)) {
    console.warn(`[build-apk] Could not patch app_name to ${displayName}`);
  } else {
    console.log(`[build-apk] app_name already ${displayName}`);
  }
}

/** Force short react-native path so Windows CMake stays under MAX_PATH (260). */
function patchExpoModulesCoreReactNativeDir(buildPaths) {
  const monorepoRoot = resolve(join(buildPaths.appRoot, "..", ".."));
  const shortRnCandidates = [
    process.env.POPS_RN_PATH,
    "C:\\rn",
    join(monorepoRoot, "node_modules", "react-native"),
  ].filter(Boolean);
  let rnShort = null;
  for (const candidate of shortRnCandidates) {
    if (existsSync(join(candidate, "package.json"))) {
      rnShort = candidate.replace(/\\/g, "/");
      break;
    }
  }
  if (!rnShort) {
    console.warn("[build-apk] Short react-native path missing");
    return;
  }

  const gradleFiles = [];
  const shortEmcCandidates = [
    process.env.POPS_EMC_PATH,
    "C:\\emc",
    join(monorepoRoot, "node_modules", "expo-modules-core"),
  ].filter(Boolean);
  for (const emcRoot of shortEmcCandidates) {
    const g = join(emcRoot, "android", "build.gradle");
    if (existsSync(g)) gradleFiles.push(g);
  }

  const direct = join(monorepoRoot, "node_modules", "expo-modules-core", "android", "build.gradle");
  if (existsSync(direct)) gradleFiles.push(direct);

  const pnpmRoot = join(monorepoRoot, "node_modules", ".pnpm");
  if (existsSync(pnpmRoot)) {
    for (const entry of readdirSync(pnpmRoot)) {
      if (!entry.startsWith("expo-modules-core@")) continue;
      const g = join(pnpmRoot, entry, "node_modules", "expo-modules-core", "android", "build.gradle");
      if (existsSync(g)) gradleFiles.push(g);
    }
  }

  const needle =
    /: file\(providers\.exec \{\s*workingDir\(rootDir\)\s*commandLine\("node", "--print", "require\.resolve\('react-native\/package\.json'\)"\)\s*\}\.standardOutput\.asText\.get\(\)\.trim\(\)\)\.parent/;
  const replacement = `: file("${rnShort}")`;

  for (const gradlePath of [...new Set(gradleFiles)]) {
    let text = readFileSync(gradlePath, "utf8");
    if (text.includes(`file("${rnShort}")`)) continue;
    if (!needle.test(text)) {
      const loose = text.replace(
        /commandLine\("node", "--print", "require\.resolve\('react-native\/package\.json'\)"\)[\s\S]*?\.parent/,
        `/* patched */\n  : file("${rnShort}")`,
      );
      if (loose === text) {
        console.warn("[build-apk] Could not patch REACT_NATIVE_DIR in", gradlePath);
        continue;
      }
      text = loose;
    } else {
      text = text.replace(needle, replacement);
    }
    writeFileSync(gradlePath, text);
    console.log(`[build-apk] Patched REACT_NATIVE_DIR → ${rnShort} in ${gradlePath}`);
  }
}

function writeLocalProperties(androidDirPath) {
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (isWin
      ? join(process.env.LOCALAPPDATA || "", "Android", "Sdk")
      : join(process.env.HOME || "", "Android", "Sdk"));
  if (!sdk || !existsSync(sdk)) {
    console.warn("[build-apk] Android SDK not found — set ANDROID_HOME before building");
    return;
  }
  const propsPath = join(androidDirPath, "local.properties");
  const sdkDir = sdk.replace(/\\/g, "/");
  writeFileSync(propsPath, `sdk.dir=${sdkDir}\n`, "utf8");
  console.log(`[build-apk] Wrote local.properties → ${sdkDir}`);
}

function applyAndroidPatches(buildPaths) {
  const buildGradle = join(buildPaths.androidDir, "app", "build.gradle");
  patchAndroidBuildGradle(buildGradle, buildPaths.appRoot);
  patchGradleProperties(join(buildPaths.androidDir, "gradle.properties"));
  forceArm64Only(join(buildPaths.androidDir, "gradle.properties"));
  forceArm64AbiFilters(buildGradle);
  forceApplicationId(buildGradle, variant.packageId);
  forceAppDisplayName(buildPaths.androidDir, variant.displayName);
  patchExpoModulesCoreReactNativeDir(buildPaths);
  writeLocalProperties(buildPaths.androidDir);
  patchAndroidCleartextTraffic(buildPaths.androidDir);
}

/**
 * Android 9+ blocks cleartext HTTP by default — branch print server is http://IP:9740.
 * app.json usesCleartextTraffic is ignored when android/ is reused without prebuild.
 */
function patchAndroidCleartextTraffic(androidDirPath) {
  const manifestPath = join(androidDirPath, "app", "src", "main", "AndroidManifest.xml");
  if (!existsSync(manifestPath)) return;
  let manifest = readFileSync(manifestPath, "utf8");
  if (!manifest.includes("android.permission.ACCESS_WIFI_STATE")) {
    manifest = manifest.replace(
      '<uses-permission android:name="android.permission.INTERNET"/>',
      '<uses-permission android:name="android.permission.INTERNET"/>\n  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>',
    );
  }

  const xmlDir = join(androidDirPath, "app", "src", "main", "res", "xml");
  mkdirSync(xmlDir, { recursive: true });
  const nscPath = join(xmlDir, "network_security_config.xml");
  writeFileSync(
    nscPath,
    `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`,
    "utf8",
  );

  if (!manifest.includes("usesCleartextTraffic")) {
    manifest = manifest.replace(
      /<application\b([^>]*)>/,
      '<application$1 android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config">',
    );
  } else if (!manifest.includes("networkSecurityConfig")) {
    manifest = manifest.replace(
      'android:usesCleartextTraffic="true"',
      'android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config"',
    );
  }
  // Collapse duplicate attributes if any prior partial patch
  manifest = manifest.replace(
    /android:usesCleartextTraffic="true"(\s+android:usesCleartextTraffic="true")+/g,
    'android:usesCleartextTraffic="true"',
  );
  writeFileSync(manifestPath, manifest);
  console.log("[build-apk] Enabled cleartext HTTP (LAN print server :9740)");
}

function clearAutolinkingCache(androidDirPath) {
  const autolinkDir = join(androidDirPath, "build", "generated", "autolinking");
  if (existsSync(autolinkDir)) {
    rmSync(autolinkDir, { recursive: true, force: true });
  }
}

function seedAutolinkingJson(buildPaths, apiUrl) {
  const outDir = join(buildPaths.androidDir, "build", "generated", "autolinking");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "autolinking.json");
  const result = spawnSync(
    "node",
    [
      "--no-warnings",
      "--eval",
      "require(require.resolve('expo-modules-autolinking', { paths: [require.resolve('expo/package.json')] }))(process.argv.slice(1))",
      "react-native-config",
      "--json",
      "--platform",
      "android",
    ],
    {
      cwd: buildPaths.appRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: apiUrl,
        EXPO_PUBLIC_APP_VARIANT: variant.envVariant,
        APP_VARIANT: variant.envVariant,
      },
    },
  );
  if (result.status !== 0 || !result.stdout?.includes("packageName")) {
    console.error("[build-apk] Failed to generate autolinking.json");
    if (result.stderr) console.error(result.stderr);
    process.exit(1);
  }
  writeFileSync(outFile, result.stdout.trim());
  console.log(`[build-apk] Wrote ${outFile}`);

  // Rewrite long .pnpm realpaths to short hoisted node_modules paths (Windows MAX_PATH).
  try {
    const monorepoRoot = resolve(join(buildPaths.appRoot, "..", ".."));
    let text = readFileSync(outFile, "utf8");
    text = text.replace(
      /([A-Za-z]:[\\/](?:[^"\\]+[\\/])*?)node_modules[\\/]\.pnpm[\\/][^"\\]+[\\/]node_modules[\\/]([^"\\/]+)/g,
      (_m, _prefix, pkg) => join(monorepoRoot, "node_modules", pkg).replace(/\\/g, "\\\\"),
    );
    // Prefer ultra-short physical copies when present (avoids CMAKE_OBJECT_PATH_MAX).
    if (existsSync("C:\\emc\\package.json")) {
      text = text.replace(
        /([A-Za-z]:[\\/][^"]*[\\/]expo-modules-core)(?=[\\/"] )/g,
        "C:\\\\emc",
      );
      text = text.split("expo-modules-core").length
        ? text.replace(
            /"root":\s*"[^"]*expo-modules-core"/g,
            '"root":"C:\\\\emc"',
          )
        : text;
      text = text.replace(/"path":\s*"[^"]*expo-modules-core"/g, '"path":"C:\\\\emc"');
    }
    if (existsSync("C:\\rn\\package.json")) {
      text = text.replace(/"root":\s*"[^"]*react-native"/g, '"root":"C:\\\\rn"');
      text = text.replace(/"path":\s*"[^"]*[\\/]react-native"/g, '"path":"C:\\\\rn"');
    }
    writeFileSync(outFile, text);
  } catch (err) {
    console.warn("[build-apk] autolinking path rewrite skipped:", err instanceof Error ? err.message : err);
  }

  const lockFiles = ["package.json", "yarn.lock", "package-lock.json", "react-native.config.js"];
  for (const name of lockFiles) {
    const lockPath = join(buildPaths.appRoot, name);
    if (!existsSync(lockPath)) continue;
    const digest = createHash("sha256").update(readFileSync(lockPath)).digest();
    const sha = BigInt(`0x${digest.toString("hex")}`).toString(16);
    writeFileSync(join(outDir, `${name}.sha`), sha);
  }
}

const apiUrl = loadEnvApiUrl();
console.log(`[build-apk] Variant: ${variantArg}`);
console.log(`[build-apk] API URL: ${apiUrl}`);

const paths = resolveBuildPaths();
ensureAndroidProject(apiUrl, paths);
applyAndroidPatches(paths);
clearAutolinkingCache(paths.androidDir);
seedAutolinkingJson(paths, apiUrl);

console.log("[build-apk] Assembling release APK…");
const androidSdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (isWin ? join(process.env.LOCALAPPDATA || "", "Android", "Sdk") : "");
const gradleEnv = {
  EXPO_PUBLIC_API_BASE_URL: apiUrl,
  EXPO_PUBLIC_APP_VARIANT: variant.envVariant,
  APP_VARIANT: variant.envVariant,
  EXPO_NO_METRO_WORKSPACE_ROOT: "1",
  NODE_OPTIONS: "--max-old-space-size=4096",
  ORG_GRADLE_PROJECT_reactNativeArchitectures: "arm64-v8a",
  ...(androidSdk && existsSync(androidSdk)
    ? { ANDROID_HOME: androidSdk, ANDROID_SDK_ROOT: androidSdk }
    : {}),
};

// Metro writes sourcemaps here before Gradle creates the folder (clean prebuild).
mkdirSync(
  join(paths.androidDir, "app", "build", "intermediates", "sourcemaps", "react", "release"),
  { recursive: true },
);
mkdirSync(
  join(paths.androidDir, "app", "build", "generated", "assets", "createBundleReleaseJsAndAssets"),
  { recursive: true },
);

const gradlew = join(paths.androidDir, isWin ? "gradlew.bat" : "gradlew");
// Fast builds keep the Gradle daemon warm (~minutes saved on repeat builds).
const useDaemon =
  process.env.POPS_GRADLE_DAEMON === "1" ||
  (process.env.POPS_FAST_BUILD !== "0" && process.env.POPS_GRADLE_DAEMON !== "0");
const gradleArgs = useDaemon
  ? ["assembleRelease", "--stacktrace"]
  : ["assembleRelease", "--no-daemon", "--stacktrace"];
if (useDaemon) {
  console.log("[build-apk] Gradle daemon enabled (fast)");
}
if (isWin) {
  run("cmd.exe", ["/c", gradlew, ...gradleArgs], {
    cwd: paths.androidDir,
    env: gradleEnv,
    shell: false,
  });
} else {
  run(gradlew, gradleArgs, { cwd: paths.androidDir, env: gradleEnv, shell: false });
}

if (!existsSync(paths.apkSrc)) {
  console.error("[build-apk] APK not found at expected path:", paths.apkSrc);
  process.exit(1);
}

const outDir = join(appRoot, "dist");
mkdirSync(outDir, { recursive: true });
const apkDest = join(outDir, variant.apkName);
copyFileSync(paths.apkSrc, apkDest);
if (resolve(paths.apkSrc) !== resolve(apkDest)) {
  console.log(`[build-apk] Also copied to ${apkDest}`);
}

console.log(`[build-apk] Done → ${apkDest}`);

try {
  const manifestScript = join(__dirname, "write-mobile-update-manifest.mjs");
  if ((variantArg === "admin" || variantArg === "staff") && existsSync(manifestScript)) {
    const appJsonPath = join(appRoot, "app.json");
    let ver = "1.0.0";
    let code = "0";
    if (existsSync(appJsonPath)) {
      const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
      ver = String(appJson.expo?.version ?? ver);
      code = String(appJson.expo?.android?.versionCode ?? code);
    }
    const r = spawnSync(process.execPath, [manifestScript, variantArg, ver, code], {
      cwd: appRoot,
      stdio: "inherit",
    });
    if (r.status !== 0) {
      console.warn("[build-apk] update manifest write failed (APK still built)");
    }
  }
} catch (err) {
  console.warn("[build-apk] update manifest skipped:", err instanceof Error ? err.message : err);
}
