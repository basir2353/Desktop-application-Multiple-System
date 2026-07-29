const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [monorepoRoot, "D:\\emc"].filter((p) => fs.existsSync(p));
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules/.pnpm/node_modules"),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Pin expo-modules-core to a same-drive physical tree (avoids C:\emc cross-drive Metro failures).
const emcCandidates = [
  process.env.POPS_EMC_PATH,
  "D:\\emc",
  path.resolve(projectRoot, "node_modules/expo-modules-core"),
].filter(Boolean);
const emcRoot = emcCandidates.find((p) => fs.existsSync(path.join(p, "package.json")));

if (emcRoot) {
  const defaultResolve = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "expo-modules-core" || moduleName.startsWith("expo-modules-core/")) {
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
}

module.exports = config;
