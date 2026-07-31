import { createSqlJsDb, type PlatformSqliteDb } from "@platform/database-sqlite";
import { loadPersistedSqliteBytes, persistSqliteNow, schedulePersistSqlite } from "./localSettings";

type RuntimeDb = {
  db: PlatformSqliteDb;
  exportBinary: () => Uint8Array;
  persist: () => Promise<void>;
};

let singleton: RuntimeDb | null = null;

export async function getRuntimeDb(): Promise<RuntimeDb> {
  if (singleton) return singleton;

  // Force origin-root wasm URL (never /pos/sql-wasm.wasm → SPA HTML).
  const wasmBaseUrl =
    typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  const persisted = loadPersistedSqliteBytes();
  const next = await createSqlJsDb({ wasmBaseUrl, persisted });

  singleton = {
    db: next.db,
    exportBinary: next.exportBinary,
    persist: async () => {
      schedulePersistSqlite(next.exportBinary);
    },
  };

  // Ensure first write is saved.
  await persistSqliteNow(next.exportBinary);
  return singleton;
}

/** Call after mutating settings_kv or outbox so local data survives restarts. */
export async function persistRuntimeDb(): Promise<void> {
  if (!singleton) return;
  await persistSqliteNow(singleton.exportBinary);
}
