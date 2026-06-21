import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { SQLITE_BOOTSTRAP_DDL } from "./migrations";

export type PlatformSqliteDb = ReturnType<typeof drizzle<typeof schema>>;

export type CreateSqlJsOptions = {
  /** Base URL for fetching `sql-wasm.wasm` (e.g. Vite dev server root). */
  wasmBaseUrl?: string;
  /** Optional persisted database bytes to hydrate. */
  persisted?: Uint8Array;
};

export async function createSqlJsDb(opts: CreateSqlJsOptions = {}): Promise<{
  raw: SqlJsDatabase;
  db: PlatformSqliteDb;
  exportBinary: () => Uint8Array;
}> {
  const wasmBaseUrl = opts.wasmBaseUrl?.replace(/\/$/, "") ?? "";
  const SQL = await initSqlJs({
    locateFile: (file: string) => `${wasmBaseUrl}/${file}`,
  });
  const raw = opts.persisted ? new SQL.Database(opts.persisted) : new SQL.Database();
  raw.exec(SQLITE_BOOTSTRAP_DDL);
  const db = drizzle(raw, { schema });
  return {
    raw,
    db,
    exportBinary: () => raw.export(),
  };
}

export * from "./schema";
export { SQLITE_BOOTSTRAP_DDL } from "./migrations";
