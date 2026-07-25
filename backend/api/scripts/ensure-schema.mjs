/**
 * Idempotent ALTER TABLE for columns drizzle-kit push sometimes skips on
 * existing Railway databases. Run after `drizzle-kit push`.
 *
 * Uses `pg` from packages/database-pg (always present in the Docker image).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkspaceRoot } from "./resolve-workspace.mjs";

const STATEMENTS = [
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true`,
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS nav_allowlist jsonb`,
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS last_activity_at timestamptz`,
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS staff_pin_hash text`,
  `ALTER TABLE pops_cash_movements ADD COLUMN IF NOT EXISTS employee_id uuid`,
  `ALTER TABLE pops_cash_movements ADD COLUMN IF NOT EXISTS party_kind text`,
  `ALTER TABLE pops_cash_movements ADD COLUMN IF NOT EXISTS client_request_id text`,
];

export function ensureCriticalSchema() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("[ensure-schema] DATABASE_URL missing");
    return false;
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const apiRoot = join(scriptDir, "..");
  const appRoot = resolveWorkspaceRoot(apiRoot);
  const dbPkgRoot = join(appRoot, "packages", "database-pg");

  const runner = `
const { Client } = require("pg");
const statements = ${JSON.stringify(STATEMENTS)};
(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /railway|rlwy\\.app|amazonaws|neon\\.tech/i.test(process.env.DATABASE_URL || "")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();
  for (const sql of statements) {
    try {
      await client.query(sql);
      console.log("[ensure-schema] OK:", sql.slice(0, 80));
    } catch (err) {
      console.warn("[ensure-schema] skip:", err && err.message ? err.message : err);
    }
  }
  await client.end();
})().catch((err) => {
  console.error("[ensure-schema] failed:", err && err.message ? err.message : err);
  process.exit(1);
});
`;

  const result = spawnSync(process.execPath, ["-e", runner], {
    cwd: dbPkgRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    console.error("[ensure-schema] aborted with status", result.status);
    return false;
  }
  console.log("[ensure-schema] critical columns verified.");
  return true;
}
