export type AccessTokenClaims = {
  sub: string;
  organizationId: string;
  permissions: string[];
  role?: string;
  branchScope?: string;
  riderId?: string;
  exp?: number;
};

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Pure JS base64url decode — no atob/base64-js (both break in some RN release bundles). */
function base64UrlToString(value: string): string {
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) base64 += "=".repeat(4 - pad);

  const lookup = new Uint8Array(256);
  for (let i = 0; i < BASE64_CHARS.length; i += 1) {
    lookup[BASE64_CHARS.charCodeAt(i)] = i;
  }

  const len = base64.length;
  let bufferLength = Math.floor(len * 0.75);
  if (base64[len - 1] === "=") bufferLength -= 1;
  if (base64[len - 2] === "=") bufferLength -= 1;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)]!;
    const encoded2 = lookup[base64.charCodeAt(i + 1)]!;
    const encoded3 = lookup[base64.charCodeAt(i + 2)]!;
    const encoded4 = lookup[base64.charCodeAt(i + 3)]!;
    bytes[p] = (encoded1 << 2) | (encoded2 >> 4);
    p += 1;
    if (base64[i + 2] !== "=") {
      bytes[p] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      p += 1;
    }
    if (base64[i + 3] !== "=") {
      bytes[p] = ((encoded3 & 3) << 6) | encoded4;
      p += 1;
    }
  }

  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]!);
  return out;
}

export function decodeJwtPayload<T = unknown>(token: string): T {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");
  const json = base64UrlToString(parts[1]!);
  return JSON.parse(json) as T;
}

export function decodeAccessToken(token: string): AccessTokenClaims {
  const claims = decodeJwtPayload<AccessTokenClaims>(token);
  if (!claims || typeof claims !== "object") throw new Error("Invalid JWT payload");
  if (typeof claims.sub !== "string" || typeof claims.organizationId !== "string") {
    throw new Error("Invalid JWT payload");
  }
  if (!Array.isArray(claims.permissions)) {
    claims.permissions = [];
  }
  return claims;
}

export function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  const { exp } = decodeAccessToken(token);
  if (typeof exp !== "number") return false;
  return Date.now() >= exp * 1000 - skewSeconds * 1000;
}
