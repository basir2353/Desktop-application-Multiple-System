import { spawnSync } from "node:child_process";

const appRoot = "/app";

console.log("[railway] Applying database schema…");
const push = spawnSync("pnpm", ["--filter", "@platform/database-pg", "push"], {
  cwd: appRoot,
  stdio: "inherit",
  env: process.env,
  shell: false,
});

if (push.status !== 0) {
  console.error("[railway] Schema push failed — check DATABASE_URL and redeploy.");
  process.exit(push.status ?? 1);
}

console.log("[railway] Starting API…");
const api = spawnSync("node", ["dist/main.js"], {
  cwd: `${appRoot}/backend/api`,
  stdio: "inherit",
  env: process.env,
});

process.exit(api.status ?? 1);
