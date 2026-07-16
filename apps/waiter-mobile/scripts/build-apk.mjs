#!/usr/bin/env node
/**
 * Build a release APK on Windows (or any OS with Java + Android SDK).
 *
 * Usage:
 *   pnpm build:apk:win           # waiter APK (default)
 *   pnpm build:apk:win rider     # rider APK
 *   pnpm build:waiter-apk         # from repo root
 *   pnpm build:rider-apk           # from repo root
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VARIANTS = {
  waiter: {
    apkName: "pops-waiter-release.apk",
    packageId: "com.platform.pops.waiter",
    envVariant: "waiter",
  },
  rider: {
    apkName: "pops-rider-release.apk",
    packageId: "com.platform.pops.rider",
    envVariant: "rider",
  },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(join(__dirname, ".."));
const androidDir = join(appRoot, "android");
const isWin = process.platform === "win32";

const variantArg = process.argv[2] === "rider" ? "rider" : "waiter";
const variant = VARIANTS[variantArg];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd ?? appRoot,
    stdio: "inherit",
    shell: opts.shell ?? isWin,
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
        ? [process.env.POPS_BUILD_ROOT, "E:\\pos-build", "C:\\pops"].filter(Boolean)
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
  writeFileSync(propsPath, text);
}

function ensureAndroidProject(apiUrl, buildPaths) {
  const buildGradle = join(buildPaths.androidDir, "app", "build.gradle");
  const currentPackage = readAndroidPackageId(buildGradle);
  const needsPrebuild = !existsSync(buildPaths.androidDir) || currentPackage !== variant.packageId;

  if (!needsPrebuild) return;

  console.log(`[build-apk] Running expo prebuild for ${variantArg} (${variant.packageId})…`);
  run("pnpm", ["exec", "expo", "prebuild", "--platform", "android", "--clean"], {
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
}

function applyAndroidPatches(buildPaths) {
  patchAndroidBuildGradle(join(buildPaths.androidDir, "app", "build.gradle"), buildPaths.appRoot);
  patchGradleProperties(join(buildPaths.androidDir, "gradle.properties"));
  forceArm64Only(join(buildPaths.androidDir, "gradle.properties"));
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
const gradleEnv = {
  EXPO_PUBLIC_API_BASE_URL: apiUrl,
  EXPO_PUBLIC_APP_VARIANT: variant.envVariant,
  APP_VARIANT: variant.envVariant,
  EXPO_NO_METRO_WORKSPACE_ROOT: "1",
};

const gradlew = join(paths.androidDir, isWin ? "gradlew.bat" : "gradlew");
if (isWin) {
  run("cmd.exe", ["/c", gradlew, "assembleRelease"], {
    cwd: paths.androidDir,
    env: gradleEnv,
    shell: false,
  });
} else {
  run(gradlew, ["assembleRelease"], { cwd: paths.androidDir, env: gradleEnv, shell: false });
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
