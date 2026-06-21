import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export type PlatformPgDb = NodePgDatabase<typeof schema>;

export function createPgDb(connectionString: string): { db: PlatformPgDb; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export * from "./schema/index";
