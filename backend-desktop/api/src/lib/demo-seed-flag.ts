import { sql } from "drizzle-orm";
import type { PlatformPgDb } from "@platform/database-pg";

export type DemoSeedModule =
  | "inventory"
  | "menu"
  | "store"
  | "pharmacy"
  | "hr"
  | "billing";

let ensured = false;

/** One-time demo seed marker so emptying a module does not resurrect sample rows. */
export async function ensureDemoSeedFlagsTable(db: PlatformPgDb): Promise<void> {
  if (ensured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pops_demo_seed_flags (
      organization_id uuid NOT NULL,
      branch_id uuid NOT NULL,
      module text NOT NULL,
      seeded_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (branch_id, module)
    )
  `);
  ensured = true;
}

export async function hasDemoSeedFlag(
  db: PlatformPgDb,
  branchId: string,
  module: DemoSeedModule,
): Promise<boolean> {
  await ensureDemoSeedFlagsTable(db);
  const result = await db.execute(
    sql`SELECT 1 AS ok FROM pops_demo_seed_flags
        WHERE branch_id = ${branchId} AND module = ${module}
        LIMIT 1`,
  );
  const rows = (result as { rows?: unknown[]; rowCount?: number }).rows;
  if (Array.isArray(rows) && rows.length > 0) return true;
  return Number((result as { rowCount?: number }).rowCount ?? 0) > 0;
}

export async function markDemoSeedDone(
  db: PlatformPgDb,
  organizationId: string,
  branchId: string,
  module: DemoSeedModule,
): Promise<void> {
  await ensureDemoSeedFlagsTable(db);
  await db.execute(sql`
    INSERT INTO pops_demo_seed_flags (organization_id, branch_id, module)
    VALUES (${organizationId}, ${branchId}, ${module})
    ON CONFLICT (branch_id, module) DO NOTHING
  `);
}
