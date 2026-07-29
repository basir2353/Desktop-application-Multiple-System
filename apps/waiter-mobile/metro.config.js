const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
/** Prefer D:\pops short mirror so Android drawable asset filenames stay under MAX_PATH. */
const monorepoRoot = path.resolve(projectRoot, "../..");
const REAL_REPO = "D:\\desktop\\Desktop-application-Multiple-System";

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [projectRoot, monorepoRoot, REAL_REPO, "D:\\emc"].filter(
  (p, i, arr) => fs.existsSync(p) && arr.indexOf(p) === i,
);

const appNodeModules = path.resolve(projectRoot, "node_modules");
config.resolver.nodeModulesPaths = [
  appNodeModules,
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules/.pnpm/node_modules"),
  path.resolve(REAL_REPO, "node_modules"),
  path.resolve(REAL_REPO, "node_modules/.pnpm/node_modules"),
].filter((p, i, arr) => fs.existsSync(p) && arr.indexOf(p) === i);

config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Keep short junction paths (do NOT realpath) — realpaths make AAPT drawable names too long on Windows.
const extra = {};
for (const name of ["expo-router", "expo", "react", "react-native"]) {
  const candidate = path.join(appNodeModules, name);
  if (fs.existsSync(candidate)) extra[name] = candidate;
}
const shortElements = path.join(projectRoot, "vendor", "rne");
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...extra,
  ...(fs.existsSync(path.join(shortElements, "package.json"))
    ? { "@react-navigation/elements": shortElements }
    : {}),
};

const emcCandidates = [
  process.env.POPS_EMC_PATH,
  "D:\\emc",
  path.resolve(projectRoot, "node_modules/expo-modules-core"),
].filter(Boolean);
const emcRoot = emcCandidates.find((p) => fs.existsSync(path.join(p, "package.json")));

const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force short-path entry so Metro does not walk broken hierarchical lookup under D:\pops.
  if (moduleName === "expo-router/entry" || moduleName === "expo-router/entry.js") {
    const hits = [
      path.join(appNodeModules, "expo-router", "entry.js"),
      path.join(monorepoRoot, "node_modules", ".pnpm", "node_modules", "expo-router", "entry.js"),
      path.join(REAL_REPO, "node_modules", ".pnpm", "node_modules", "expo-router", "entry.js"),
    ];
    const hit = hits.find((p) => fs.existsSync(p));
    if (hit) return { type: "sourceFile", filePath: hit };
  }

  const shortElements = path.join(projectRoot, "vendor", "rne");
  if (
    fs.existsSync(path.join(shortElements, "package.json")) &&
    (moduleName === "@react-navigation/elements" ||
      moduleName.startsWith("@react-navigation/elements/"))
  ) {
    const rest =
      moduleName === "@react-navigation/elements"
        ? null
        : moduleName.slice("@react-navigation/elements/".length);
    if (!rest) {
      const main = path.join(shortElements, "lib", "module", "index.js");
      const fallback = path.join(shortElements, "src", "index.tsx");
      const hit = [main, fallback, path.join(shortElements, "index.js")].find((p) => fs.existsSync(p));
      if (hit) return { type: "sourceFile", filePath: hit };
    } else {
      const abs = path.join(shortElements, rest);
      const withExt = [abs, `${abs}.js`, `${abs}.tsx`, `${abs}.ts`, path.join(abs, "index.js")].find(
        (p) => fs.existsSync(p),
      );
      if (withExt) return { type: "sourceFile", filePath: withExt };
    }
  }

  if (emcRoot && (moduleName === "expo-modules-core" || moduleName.startsWith("expo-modules-core/"))) {
    const rest =
      moduleName === "expo-modules-core" ? null : moduleName.slice("expo-modules-core/".length);
    if (!rest) {
      const main = path.join(emcRoot, "src", "index.ts");
      const fallback = path.join(emcRoot, "build", "index.js");
      return {
        type: "sourceFile",
        filePath: fs.existsSync(main) ? main : fallback,
      };
    }
    const abs = path.join(emcRoot, rest);
    const withExt = [abs, `${abs}.ts`, `${abs}.tsx`, `${abs}.js`, path.join(abs, "index.ts")].find(
      (p) => fs.existsSync(p),
    );
    if (withExt) return { type: "sourceFile", filePath: withExt };
  }

  if (defaultResolve) return defaultResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
