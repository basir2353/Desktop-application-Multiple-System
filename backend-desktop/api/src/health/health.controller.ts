import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { PlatformPgDb } from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";

@Controller("health")
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: PlatformPgDb) {}

  @Get()
  getHealth(): { status: string; ts: string } {
    return { status: "ok", ts: new Date().toISOString() };
  }

  /** DB readiness — helps diagnose Railway login 500s after deploy. */
  @Get("db")
  async getDbHealth(): Promise<{
    status: "ok" | "degraded";
    checks: Record<string, boolean | number | string>;
  }> {
    const checks: Record<string, boolean | number | string> = {};

    try {
      await this.db.execute(sql`select 1`);
      checks.connected = true;
    } catch (err) {
      checks.connected = false;
      checks.error = err instanceof Error ? err.message : String(err);
      return { status: "degraded", checks };
    }

    const tables = ["users", "organization_memberships", "refresh_tokens", "pops_security_events"] as const;
    for (const table of tables) {
      try {
        const rows = await this.db.execute(
          sql.raw(`select to_regclass('public.${table}') as present`),
        );
        const present = (rows.rows[0] as { present?: string | null } | undefined)?.present;
        checks[`table_${table}`] = Boolean(present);
      } catch {
        checks[`table_${table}`] = false;
      }
    }

    try {
      const users = await this.db.execute(sql`select count(*)::int as count from users`);
      checks.userCount = Number((users.rows[0] as { count?: number } | undefined)?.count ?? 0);
    } catch (err) {
      checks.userCount = -1;
      checks.userCountError = err instanceof Error ? err.message : String(err);
    }

    const ready =
      checks.connected === true &&
      checks.table_users === true &&
      checks.table_organization_memberships === true;

    return { status: ready ? "ok" : "degraded", checks };
  }
}
