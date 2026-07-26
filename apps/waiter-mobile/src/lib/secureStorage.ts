import * as SecureStore from "expo-secure-store";

/** Android SecureStore rejects values over ~2048 bytes — chunk large JWTs. */
const CHUNK_SIZE = 1800;

async function deleteChunked(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(`${key}__chunks`).catch(() => null);
  const chunks = meta ? Number(meta) : 0;
  if (Number.isFinite(chunks) && chunks > 0) {
    await Promise.all(
      Array.from({ length: chunks }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => undefined),
      ),
    );
  }
  await SecureStore.deleteItemAsync(`${key}__chunks`).catch(() => undefined);
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (value.length <= CHUNK_SIZE) {
      await deleteChunked(key);
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}__chunks`, String(chunkCount));
    for (let i = 0; i < chunkCount; i += 1) {
      const part = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}__${i}`, part);
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  } catch (err) {
    console.warn(`[secureStorage] set failed for ${key}:`, err);
  }
}

export async function secureGet(key: string): Promise<string | null> {
  try {
    const meta = await SecureStore.getItemAsync(`${key}__chunks`);
    const chunks = meta ? Number(meta) : 0;
    if (Number.isFinite(chunks) && chunks > 0) {
      const parts: string[] = [];
      for (let i = 0; i < chunks; i += 1) {
        const part = await SecureStore.getItemAsync(`${key}__${i}`);
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join("");
    }
    return await SecureStore.getItemAsync(key);
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
