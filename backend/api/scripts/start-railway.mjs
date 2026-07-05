import { spawnSync } from "node:child_process";

const appRoot = "/app";
const apiRoot = `${appRoot}/backend/api`;
const dbPkgRoot = `${appRoot}/packages/database-pg`;

function runSchemaPush() {
  console.log("[railway] Applying database schema…");

  // pnpm exec resolves the drizzle-kit binary from the local workspace —
  // more reliable than searching for the binary path after a Docker multi-stage copy.
  const result = spawnSync(
    "pnpm",
    ["exec", "drizzle-kit", "push", "--force"],
    {
      cwd: dbPkgRoot,
      stdio: "inherit",
      env: process.env,
    }
  );

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
  console.log("[railway] Starting API server…");
  // spawnSync blocks until the API exits, keeping this script alive as the process host.
  const api = spawnSync("node", ["dist/main.js"], {
    cwd: apiRoot,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(api.status ?? 0);
}

if (!runSchemaPush()) {
  process.exit(1);
}

startApi();
