const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
/** Prefer short mirror so Android drawable asset filenames stay under MAX_PATH. */
const monorepoRoot = path.resolve(projectRoot, "../..");
const REAL_REPO_CANDIDATES = [
  process.env.POPS_REAL_REPO,
  "E:\\main pos\\Desktop-application-Multiple-System",
  "D:\\desktop\\Desktop-application-Multiple-System",
  "D:\\main pos\\Desktop-application-Multiple-System",
].filter(Boolean);
const REAL_REPO = REAL_REPO_CANDIDATES.find((p) => fs.existsSync(p)) || REAL_REPO_CANDIDATES[0];

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
// Do NOT watch the whole monorepo root — Vite's apps/launcher/node_modules/.vite
// can disappear mid-session and Metro's FallbackWatcher crashes with ENOENT.
config.watchFolders = [
  projectRoot,
  path.join(monorepoRoot, "packages"),
  path.join(REAL_REPO, "packages"),
  "D:\\emc",
  "C:\\emc",
].filter((p, i, arr) => p && fs.existsSync(p) && arr.indexOf(p) === i);

config.resolver.blockList = [
  /[/\\]\.vite[/\\].*/,
  /[/\\]apps[/\\]launcher[/\\].*/,
  /[/\\]backend-desktop[/\\].*/,
];

const appNodeModules = path.resolve(projectRoot, "node_modules");
config.resolver.nodeModulesPaths = [
  appNodeModules,
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules/.pnpm/node_modules"),
  path.resolve(REAL_REPO, "node_modules"),
  path.resolve(REAL_REPO, "node_modules/.pnpm/node_modules"),
].filter((p, i, arr) => fs.existsSync(p) && arr.indexOf(p) === i);

config.resolver.unstable_enableSymlinks = true;
// Package exports can resolve React to react.shared-subset (no hooks) → "useRef of null" in release APKs.
config.resolver.unstable_enablePackageExports = false;

// Keep short junction paths (do NOT realpath) — realpaths make AAPT drawable names too long on Windows.
const extra = {};
for (const name of ["expo-router", "expo", "react", "react-native"]) {
  const candidate = path.join(appNodeModules, name);
  if (fs.existsSync(candidate)) extra[name] = candidate;
}
// Prefer monorepo React if app-local is a broken junction
const reactRoot = [
  path.join(appNodeModules, "react"),
  path.resolve(monorepoRoot, "node_modules/react"),
  path.resolve(REAL_REPO, "node_modules/react"),
].find((p) => fs.existsSync(path.join(p, "index.js")));
if (reactRoot) extra.react = reactRoot;

const shortElements = path.join(projectRoot, "vendor", "rne");
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...extra,
  ...(fs.existsSync(path.join(shortElements, "package.json"))
    ? { "@react-navigation/elements": shortElements }
    : {}),
  ...(fs.existsSync(path.join(projectRoot, "vendor", "dijkstrajs", "package.json"))
    ? { dijkstrajs: path.join(projectRoot, "vendor", "dijkstrajs") }
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
  // Single React instance — avoid monorepo duplicates / shared-subset.
  if (reactRoot) {
    if (moduleName === "react") {
      return { type: "sourceFile", filePath: path.join(reactRoot, "index.js") };
    }
    if (moduleName === "react/jsx-runtime") {
      return { type: "sourceFile", filePath: path.join(reactRoot, "jsx-runtime.js") };
    }
    if (moduleName === "react/jsx-dev-runtime") {
      return { type: "sourceFile", filePath: path.join(reactRoot, "jsx-dev-runtime.js") };
    }
  }

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
  if (moduleName === "dijkstrajs") {
    const dj = path.join(projectRoot, "vendor", "dijkstrajs");
    const hits = [
      path.join(dj, "dijkstra.js"),
      path.join(dj, "index.js"),
      path.join(dj, "package.json"),
    ];
    if (fs.existsSync(path.join(dj, "package.json"))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dj, "package.json"), "utf8"));
        const main = path.join(dj, pkg.main || "dijkstra.js");
        if (fs.existsSync(main)) return { type: "sourceFile", filePath: main };
      } catch {
        /* fall through */
      }
    }
    const hit = hits.find((p) => fs.existsSync(p) && !p.endsWith("package.json"));
    if (hit) return { type: "sourceFile", filePath: hit };
  }
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

  // Workspace packages (@platform/*) — resolve via junction / packages folder.
  if (moduleName === "@platform/contracts" || moduleName.startsWith("@platform/contracts/")) {
    const contractsRoot = [
      path.join(appNodeModules, "@platform", "contracts"),
      path.join(monorepoRoot, "packages", "contracts"),
      path.join(REAL_REPO, "packages", "contracts"),
    ].find((p) => fs.existsSync(path.join(p, "package.json")));
    if (contractsRoot) {
      const rest =
        moduleName === "@platform/contracts"
          ? null
          : moduleName.slice("@platform/contracts/".length);
      if (!rest) {
        const main = path.join(contractsRoot, "dist", "index.js");
        const src = path.join(contractsRoot, "src", "index.ts");
        const hit = [main, src].find((p) => fs.existsSync(p));
        if (hit) return { type: "sourceFile", filePath: hit };
      } else {
        const abs = path.join(contractsRoot, rest);
        const withExt = [abs, `${abs}.js`, `${abs}.ts`, path.join(abs, "index.js")].find((p) =>
          fs.existsSync(p),
        );
        if (withExt) return { type: "sourceFile", filePath: withExt };
      }
    }
  }
  if (moduleName === "@platform/auth-client" || moduleName.startsWith("@platform/auth-client/")) {
    const authRoot = [
      path.join(appNodeModules, "@platform", "auth-client"),
      path.join(monorepoRoot, "packages", "auth-client"),
      path.join(REAL_REPO, "packages", "auth-client"),
    ].find((p) => fs.existsSync(path.join(p, "package.json")));
    if (authRoot) {
      const rest =
        moduleName === "@platform/auth-client"
          ? null
          : moduleName.slice("@platform/auth-client/".length);
      if (!rest) {
        const main = path.join(authRoot, "dist", "index.js");
        const src = path.join(authRoot, "src", "index.ts");
        const hit = [main, src].find((p) => fs.existsSync(p));
        if (hit) return { type: "sourceFile", filePath: hit };
      }
    }
  }

  // TypeScript ESM imports often use ".js" for ".ts" sources — Metro needs a redirect.
  if (
    (moduleName.startsWith("./") || moduleName.startsWith("../")) &&
    moduleName.endsWith(".js") &&
    context.originModulePath
  ) {
    const dir = path.dirname(context.originModulePath);
    const base = moduleName.slice(0, -3);
    const hit = [".ts", ".tsx", ".js", ".jsx"]
      .map((ext) => path.resolve(dir, base + ext))
      .find((p) => fs.existsSync(p));
    if (hit) return { type: "sourceFile", filePath: hit };
  }

  if (defaultResolve) return defaultResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
