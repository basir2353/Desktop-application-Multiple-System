import AsyncStorage from "@react-native-async-storage/async-storage";

const memory = new Map<string, string>();
let hydrated = false;

export function mzStorageGet(key: string): string | null {
  return memory.has(key) ? (memory.get(key) as string) : null;
}

export function mzStorageSet(key: string, value: string): void {
  memory.set(key, value);
  void AsyncStorage.setItem(key, value).catch(() => undefined);
}

export function mzStorageRemove(key: string): void {
  memory.delete(key);
  void AsyncStorage.removeItem(key).catch(() => undefined);
}

export async function hydrateMobizoneStorage(branchCode: string): Promise<void> {
  const keys = [`mobizone-db-v2:${branchCode}`, `mobizone-db-v1:${branchCode}`];
  for (const key of keys) {
    try {
      // Never clobber in-memory writes that raced ahead of AsyncStorage hydrate.
      if (memory.has(key)) continue;
      const raw = await AsyncStorage.getItem(key);
      if (raw && !memory.has(key)) memory.set(key, raw);
    } catch {
      /* ignore */
    }
  }
  hydrated = true;
}

export function isMobizoneStorageHydrated(): boolean {
  return hydrated;
}
