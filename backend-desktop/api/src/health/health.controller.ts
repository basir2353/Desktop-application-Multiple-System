import { Controller, Get, Inject, Optional } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { PlatformPgDb } from "@platform/database-pg";
import type pg from "pg";
import { DRIZZLE, DRIZZLE_POOL } from "../drizzle/drizzle.tokens";
import { pingRedis } from "../infra/redisPing";
import { resolveScaleProfile, scaleDefaults } from "../infra/scaleProfile";
import { getRequestLoadStats } from "../load/requestConcurrency";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    @Optional() @Inject(DRIZZLE_POOL) private readonly pool?: pg.Pool,
  ) {}

  @Get()
  getHealth(): { status: string; ts: string; build: string; scaleProfile: string } {
    return {
      status: "ok",
      ts: new Date().toISOString(),
      // Bump this string whenever we need to confirm Railway picked up a deploy.
      build: "scale-high-infra-2026-09-25",
      scaleProfile: resolveScaleProfile(),
    };
  }

  /**
   * Scale / capacity snapshot for Railway replicas + Redis + DB pool.
   * Use this after setting SCALE_PROFILE=high to verify the live stack.
   */
  @Get("scale")
  async getScaleHealth(): Promise<{
    status: "ok" | "degraded";
    profile: string;
    checks: Record<string, boolean | number | string | null>;
    recommendations: string[];
  }> {
    const defaults = scaleDefaults();
    const load = getRequestLoadStats();
    const redis = await pingRedis();
    const mem = process.memoryUsage();

    const checks: Record<string, boolean | number | string | null> = {
      scaleProfile: defaults.profile,
      recommendedReplicas: defaults.recommendedReplicas,
      requireRedis: defaults.requireRedis,
      redisConfigured: redis.configured,
      redisOk: redis.ok,
      redisLatencyMs: redis.latencyMs,
      dbPoolMax: this.pool?.options.max ?? Number(process.env.DATABASE_POOL_MAX ?? 0),
      dbPoolTotal: this.pool?.totalCount ?? -1,
      dbPoolIdle: this.pool?.idleCount ?? -1,
      dbPoolWaiting: this.pool?.waitingCount ?? -1,
      apiActive: load.active,
      apiQueued: load.queued,
      apiMaxConcurrent: load.maxConcurrent,
      apiMaxQueue: load.maxQueue,
      apiRejectedTotal: load.rejectedTotal,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
      nodeOptions: process.env.NODE_OPTIONS ?? "",
    };

    if (redis.error) checks.redisError = redis.error;

    try {
      await this.db.execute(sql`select 1`);
      checks.dbConnected = true;
    } catch (err) {
      checks.dbConnected = false;
      checks.dbError = err instanceof Error ? err.message : String(err);
    }

    const redisReady = !defaults.requireRedis || redis.ok;
    const dbReady = checks.dbConnected === true;
    const status = redisReady && dbReady ? "ok" : "degraded";

    return {
      status,
      profile: defaults.profile,
      checks,
      recommendations: defaults.notes,
    };
  }

  /** DB readiness — helps diagnose Railway login 500s after deploy. */
  @Get("db")
  async getDbHealth(): Promise<{
    status: "ok" | "degraded";
    checks: Record<string, boolean | number | string>;
  }> {
    const checks: Record<string, boolean | number | string> = {};

    // Safe diagnostics (no password): which DB host this API is using.
    try {
      const raw = (process.env.DATABASE_URL ?? "").trim();
      if (!raw) {
        checks.databaseUrlSet = false;
      } else {
        checks.databaseUrlSet = true;
        const u = new URL(raw.replace(/^postgresql:/i, "postgres:"));
        checks.dbHost = u.hostname || "(unknown)";
        checks.dbPort = u.port || "5432";
        checks.dbName = (u.pathname || "/").replace(/^\//, "") || "(unknown)";
      }
    } catch {
      checks.databaseUrlSet = true;
      checks.dbHost = "(unparseable)";
    }

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

    // Column probes — missing columns cause login 500 when selecting full membership rows.
    for (const col of ["active", "nav_allowlist", "last_activity_at", "staff_pin_hash"] as const) {
      try {
        const rows = await this.db.execute(
          sql.raw(
            `select 1 from information_schema.columns where table_schema='public' and table_name='organization_memberships' and column_name='${col}' limit 1`,
          ),
        );
        checks[`col_memberships_${col}`] = (rows.rows?.length ?? 0) > 0;
      } catch {
        checks[`col_memberships_${col}`] = false;
      }
    }

    try {
      await this.db.execute(
        sql`select id, email, password_hash, status, platform_role from users limit 1`,
      );
      checks.usersLoginSelect = true;
    } catch (err) {
      checks.usersLoginSelect = false;
      checks.usersLoginSelectError = err instanceof Error ? err.message : String(err);
    }

    for (const col of ["status", "platform_role", "last_set_password"] as const) {
      try {
        const rows = await this.db.execute(
          sql.raw(
            `select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='${col}' limit 1`,
          ),
        );
        checks[`col_users_${col}`] = (rows.rows?.length ?? 0) > 0;
      } catch {
        checks[`col_users_${col}`] = false;
      }
    }

    try {
      await this.db.execute(
        sql`select organization_id, role, permissions, branch_scope from organization_memberships limit 1`,
      );
      checks.membershipCoreSelect = true;
    } catch (err) {
      checks.membershipCoreSelect = false;
      checks.membershipCoreError = err instanceof Error ? err.message : String(err);
    }

    try {
      await this.db.execute(
        sql`select organization_id, role, permissions, branch_scope, active, nav_allowlist from organization_memberships limit 1`,
      );
      checks.membershipFullSelect = true;
    } catch (err) {
      checks.membershipFullSelect = false;
      checks.membershipFullError = err instanceof Error ? err.message : String(err);
    }

    const ready =
      checks.connected === true &&
      checks.table_users === true &&
      checks.table_organization_memberships === true;

    return { status: ready ? "ok" : "degraded", checks };
  }
}
