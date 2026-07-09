import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(scriptDir, "..");
const appRoot = join(apiRoot, "..", "..");
const dbPkgRoot = join(appRoot, "packages", "database-pg");

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[railway] Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

function runSchemaPush() {
  console.log("[railway] Applying database schema…");

  const pnpm = process.platform === "win32"
    ? { cmd: "corepack", args: ["pnpm", "exec", "drizzle-kit", "push", "--force"] }
    : { cmd: "pnpm", args: ["exec", "drizzle-kit", "push", "--force"] };

  const result = spawnSync(pnpm.cmd, pnpm.args, {
    cwd: dbPkgRoot,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(
      "[railway] Schema push failed — ensure DATABASE_URL is set and Postgres is reachable."
    );
    return false;
  }

  console.log("[railway] Schema push complete.");
  return true;
}

function startApi() {
  mkdirSync(join(apiRoot, "data", "uploads"), { recursive: true });

  console.log("[railway] Starting API server…");
  const api = spawnSync("node", ["dist/main.js"], {
    cwd: apiRoot,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(api.status ?? 0);
}

requireEnv("DATABASE_URL");
requireEnv("JWT_ACCESS_SECRET");

if (!runSchemaPush()) {
  process.exit(1);
}

startApi();
