import * as SecureStore from "expo-secure-store";

/** Android SecureStore rejects values over ~2048 bytes — chunk large JWTs. */
const CHUNK_SIZE = 1800;
/** Prevent infinite white screen when SecureStore never resolves on some devices. */
const STORE_TIMEOUT_MS = 2500;

async function withTimeout<T>(promise: Promise<T>, fallback: T, ms = STORE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function deleteChunked(key: string): Promise<void> {
  const meta = await withTimeout(SecureStore.getItemAsync(`${key}__chunks`).catch(() => null), null);
  const chunks = meta ? Number(meta) : 0;
  if (Number.isFinite(chunks) && chunks > 0) {
    await Promise.all(
      Array.from({ length: chunks }, (_, i) =>
        withTimeout(SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => undefined), undefined),
      ),
    );
  }
  await withTimeout(SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => undefined), undefined);
  await withTimeout(SecureStore.deleteItemAsync(key).catch(() => undefined), undefined);
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (value.length <= CHUNK_SIZE) {
      await deleteChunked(key);
      await withTimeout(SecureStore.setItemAsync(key, value), undefined);
      return;
    }
    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    await withTimeout(SecureStore.setItemAsync(`${key}__chunks`, String(chunkCount)), undefined);
    for (let i = 0; i < chunkCount; i += 1) {
      const part = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await withTimeout(SecureStore.setItemAsync(`${key}__${i}`, part), undefined);
    }
    await withTimeout(SecureStore.deleteItemAsync(key).catch(() => undefined), undefined);
  } catch (err) {
    console.warn(`[secureStorage] set failed for ${key}:`, err);
  }
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    const meta = await withTimeout(SecureStore.getItemAsync(`${key}__chunks`).catch(() => null), null);
    const chunks = meta ? Number(meta) : 0;
    if (Number.isFinite(chunks) && chunks > 0) {
      const parts: string[] = [];
      for (let i = 0; i < chunks; i += 1) {
        const part = await withTimeout(
          SecureStore.getItemAsync(`${key}__${i}`).catch(() => null),
          null,
        );
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join("");
    }
    return await withTimeout(SecureStore.getItemAsync(key).catch(() => null), null);
  } catch (err) {
    console.warn(`[secureStorage] get failed for ${key}:`, err);
    return null;
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await deleteChunked(key);
  } catch (err) {
    console.warn(`[secureStorage] delete failed for ${key}:`, err);
  }
}
