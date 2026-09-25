import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export type PlatformPgDb = NodePgDatabase<typeof schema>;

function poolSsl(connectionString: string): pg.PoolConfig["ssl"] {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  if (/sslmode=require|sslmode=verify-full|ssl=true/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  if (
    process.env.NODE_ENV === "production" &&
    !/localhost|127\.0\.0\.1/.test(connectionString)
  ) {
    return { rejectUnauthorized: false };
  }
  return false;
}

function resolvePoolMax(): number {
  const fromEnv = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  const profile = (process.env.SCALE_PROFILE ?? "default").trim().toLowerCase();
  if (profile === "enterprise" || profile === "c" || profile === "100k") return 12;
  if (profile === "high" || profile === "b" || profile === "10k") return 15;
  return 8;
}

function usesPgBouncer(connectionString: string): boolean {
  if (process.env.DATABASE_PGBOUNCER === "1" || process.env.DATABASE_PGBOUNCER === "true") {
    return true;
  }
  return /pgbouncer=true|[:/]pgbouncer\b/i.test(connectionString);
}

export function createPgDb(connectionString: string): { db: PlatformPgDb; pool: pg.Pool } {
  const pgbouncer = usesPgBouncer(connectionString);
  const pool = new pg.Pool({
    connectionString,
    max: resolvePoolMax(),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 10_000),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000),
    ...(pgbouncer ? { allowExitOnIdle: true } : {}),
    application_name: process.env.PGAPPNAME?.trim() || "platform-api",
    ssl: poolSsl(connectionString),
  });

  const db = drizzle(pool, { schema });
  return { db, pool };
}

export * from "./schema/index";
