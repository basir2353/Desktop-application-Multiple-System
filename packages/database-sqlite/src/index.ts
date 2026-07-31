import type { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import { SQLITE_BOOTSTRAP_DDL } from "./migrations";

type InitSqlJs = (config?: {
  locateFile?: (file: string) => string;
}) => Promise<SqlJsStatic>;

async function loadInitSqlJs(): Promise<InitSqlJs> {
  // Avoid static `default` import — sql.js CJS browser build has no ESM default export
  // until Vite pre-bundles it. Namespace / dynamic import works in both cases.
  const mod = await import("sql.js");
  const candidate = (mod as { default?: InitSqlJs }).default ?? (mod as unknown as InitSqlJs);
  if (typeof candidate !== "function") {
    throw new Error("sql.js did not export an init function");
  }
  return candidate;
}

export type PlatformSqliteDb = ReturnType<typeof drizzle<typeof schema>>;

export type CreateSqlJsOptions = {
  /** Base URL for fetching `sql-wasm.wasm` (e.g. Vite public root or absolute origin). */
  wasmBaseUrl?: string;
  /** Optional persisted database bytes to hydrate. */
  persisted?: Uint8Array;
};

function resolveWasmFileUrl(_wasmBaseUrl: string, file: string): string {
  // Always load from site origin root. Relative paths under /pos (etc.) return SPA HTML
  // and crash WebAssembly (magic bytes 3c 21 64 6f = "<!do").
  const name = (file.split(/[/\\]/).pop() || "sql-wasm.wasm").trim() || "sql-wasm.wasm";
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/${name}`;
  }
  return `/${name}`;
}

export async function createSqlJsDb(opts: CreateSqlJsOptions = {}): Promise<{
  raw: SqlJsDatabase;
  db: PlatformSqliteDb;
  exportBinary: () => Uint8Array;
}> {
  const wasmBaseUrl = opts.wasmBaseUrl ?? "/";
  const initSqlJs = await loadInitSqlJs();
  const SQL = await initSqlJs({
    locateFile: (file: string) => resolveWasmFileUrl(wasmBaseUrl, file),
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
