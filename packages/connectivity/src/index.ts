export type OfflineQueueEntry<T> = {
  id: string;
  payload: T;
  createdAt: string;
  attempts: number;
};

export type KeyValueStorage = {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
};

export type OfflineQueue<T> = {
  load(): OfflineQueueEntry<T>[];
  enqueue(payload: T): OfflineQueueEntry<T>;
  remove(id: string): void;
  markAttempt(id: string): void;
  size(): number;
};

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/** Subscribe to browser online/offline transitions. No-op when `window` is unavailable. */
export function subscribeConnectivity(onChange: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onOnline = () => onChange(true);
  const onOffline = () => onChange(false);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

function defaultStorage(): KeyValueStorage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function readQueue<T>(storage: KeyValueStorage, key: string): OfflineQueueEntry<T>[] {
  const raw = storage.getItem(key);
  if (raw == null || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineQueueEntry<T>[]) : [];
  } catch {
    return [];
  }
}

function writeQueue<T>(storage: KeyValueStorage, key: string, rows: OfflineQueueEntry<T>[]): void {
  storage.setItem(key, JSON.stringify(rows));
}

/** Persistent FIFO queue for offline mutations (sales, orders, etc.). */
export function createOfflineQueue<T>(
  storageKey: string,
  storage: KeyValueStorage | null = defaultStorage(),
): OfflineQueue<T> {
  if (!storage) {
    const memory: OfflineQueueEntry<T>[] = [];
    return {
      load: () => [...memory],
      enqueue(payload) {
        const entry: OfflineQueueEntry<T> = {
          id: crypto.randomUUID(),
          payload,
          createdAt: new Date().toISOString(),
          attempts: 0,
        };
        memory.push(entry);
        return entry;
      },
      remove(id) {
        const idx = memory.findIndex((r) => r.id === id);
        if (idx >= 0) memory.splice(idx, 1);
      },
      markAttempt(id) {
        const row = memory.find((r) => r.id === id);
        if (row) row.attempts += 1;
      },
      size: () => memory.length,
    };
  }

  return {
    load: () => readQueue<T>(storage, storageKey),
    enqueue(payload) {
      const queue = readQueue<T>(storage, storageKey);
      const entry: OfflineQueueEntry<T> = {
        id: crypto.randomUUID(),
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
      };
      queue.push(entry);
      writeQueue(storage, storageKey, queue);
      return entry;
    },
    remove(id) {
      writeQueue(
        storage,
        storageKey,
        readQueue<T>(storage, storageKey).filter((r) => r.id !== id),
      );
    },
    markAttempt(id) {
      const queue = readQueue<T>(storage, storageKey);
      const row = queue.find((r) => r.id === id);
      if (row) {
        row.attempts += 1;
        writeQueue(storage, storageKey, queue);
      }
    },
    size: () => readQueue<T>(storage, storageKey).length,
  };
}
