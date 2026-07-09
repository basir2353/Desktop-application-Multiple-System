import { eq } from "drizzle-orm";
import { settingsKv, type PlatformSqliteDb } from "@platform/database-sqlite";

const SQLITE_STORAGE_KEY = "platform-sqlite-v1";

export async function readSetting<T>(db: PlatformSqliteDb, key: string): Promise<T | null> {
  const rows = await db.select().from(settingsKv).where(eq(settingsKv.key, key)).limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return JSON.parse(row.valueJson) as T;
  } catch {
    return null;
  }
}

export async function writeSetting(db: PlatformSqliteDb, key: string, value: unknown): Promise<void> {
  const now = new Date().toISOString();
  const valueJson = JSON.stringify(value);
  const existing = await db.select({ key: settingsKv.key }).from(settingsKv).where(eq(settingsKv.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(settingsKv).set({ valueJson, updatedAt: now }).where(eq(settingsKv.key, key));
    return;
  }
  await db.insert(settingsKv).values({ key, valueJson, updatedAt: now });
}

export function loadPersistedSqliteBytes(): Uint8Array | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(SQLITE_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as number[];
    return Uint8Array.from(parsed);
  } catch {
    return undefined;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePersistSqlite(exportBinary: () => Uint8Array): void {
  if (typeof localStorage === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const bytes = exportBinary();
    localStorage.setItem(SQLITE_STORAGE_KEY, JSON.stringify(Array.from(bytes)));
  }, 400);
}

export async function persistSqliteNow(exportBinary: () => Uint8Array): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const bytes = exportBinary();
  localStorage.setItem(SQLITE_STORAGE_KEY, JSON.stringify(Array.from(bytes)));
}
