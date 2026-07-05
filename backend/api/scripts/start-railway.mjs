import { spawn, spawnSync } from "node:child_process";

const appRoot = "/app";
const apiRoot = `${appRoot}/backend/api`;

function runSchemaPush(): boolean {
  console.log("[railway] Applying database schema…");
  const push = spawnSync("pnpm", ["--filter", "@platform/database-pg", "push"], {
    cwd: appRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (push.status !== 0) {
    console.error("[railway] Schema push failed — check DATABASE_URL and Postgres is running.");
    return false;
  }

  console.log("[railway] Schema push complete.");
  return true;
}

function startApi(): void {
  console.log("[railway] Starting API…");
  const api = spawn("node", ["dist/main.js"], {
    cwd: apiRoot,
    stdio: "inherit",
    env: process.env,
  });

  api.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[railway] API exited via signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    api.kill(signal);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// When Railway runs preDeployCommand, skip the duplicate push here.
if (process.env.RAILWAY_SKIP_SCHEMA_PUSH !== "true" && !runSchemaPush()) {
  process.exit(1);
}

startApi();
