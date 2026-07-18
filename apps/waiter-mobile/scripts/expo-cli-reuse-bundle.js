#!/usr/bin/env node
/**
 * Gradle BundleHermesCTask cliFile stub:
 * If --bundle-output already exists (pre-bundled), exit 0 so Hermes can run without re-running Metro.
 * Otherwise fall through to the real Expo CLI.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
const outIdx = args.indexOf("--bundle-output");
const out = outIdx >= 0 ? args[outIdx + 1] : null;

if (out && fs.existsSync(out)) {
  const size = fs.statSync(out).size;
  if (size > 1000) {
    console.log(`[reuse-bundle] Using existing bundle (${size} bytes): ${out}`);
    process.exit(0);
  }
}

const expoPkg = require.resolve("expo/package.json", { paths: [process.cwd()] });
const cli = require.resolve("@expo/cli", { paths: [path.dirname(expoPkg)] });
const result = spawnSync(process.execPath, [cli, ...args], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});
process.exit(result.status ?? 1);
