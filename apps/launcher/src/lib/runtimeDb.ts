import { createSqlJsDb, type PlatformSqliteDb } from "@platform/database-sqlite";

type RuntimeDb = { db: PlatformSqliteDb; exportBinary: () => Uint8Array };

let singleton: RuntimeDb | null = null;

export async function getRuntimeDb(): Promise<RuntimeDb> {
  if (singleton) return singleton;
  const wasmBaseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
  const next = await createSqlJsDb({ wasmBaseUrl });
  singleton = next;
  return next;
}
