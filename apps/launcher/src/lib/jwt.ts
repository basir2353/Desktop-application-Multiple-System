export type AccessTokenClaims = {
  sub: string;
  organizationId: string;
  permissions: string[];
  exp?: number;
};

export function decodeJwtPayload<T = unknown>(token: string): T {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");
  const payload = parts[1];
  const json = base64UrlToString(payload);
  return JSON.parse(json) as T;
}

function base64UrlToString(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function decodeAccessToken(token: string): AccessTokenClaims {
  return decodeJwtPayload<AccessTokenClaims>(token);
}

export function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  const { exp } = decodeAccessToken(token);
  if (typeof exp !== "number") return false;
  return Date.now() >= exp * 1000 - skewSeconds * 1000;
}
