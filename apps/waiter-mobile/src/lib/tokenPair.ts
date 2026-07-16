export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

/** Manual token response parsing — avoids Zod in RN release bundles. */
export function parseTokenPair(json: unknown): TokenPair {
  if (!json || typeof json !== "object") throw new Error("Invalid login response from server");
  const row = json as Record<string, unknown>;
  const accessToken = row.accessToken;
  const refreshToken = row.refreshToken;
  const expiresIn = row.expiresIn;
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("Invalid login response from server");
  }
  if (typeof refreshToken !== "string" || !refreshToken.trim()) {
    throw new Error("Invalid login response from server");
  }
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Invalid login response from server");
  }
  return { accessToken, refreshToken, expiresIn };
}
