import { tokenPairSchema } from "@platform/contracts";
import { getApiBaseUrl } from "../lib/apiBase";

export async function pinLogin(
  branchCode: string,
  pin: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(`${getApiBaseUrl()}/v1/auth/pin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branchCode: branchCode.trim().toUpperCase(), pin }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    const fallback =
      res.status === 404
        ? "PIN login is not available on this API yet. Ask admin to redeploy the latest backend, or use email login."
        : `PIN login failed: ${res.status}`;
    throw new Error(err?.message ?? fallback);
  }
  return tokenPairSchema.parse(await res.json());
}
