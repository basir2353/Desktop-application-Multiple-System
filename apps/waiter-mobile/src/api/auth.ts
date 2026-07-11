import { tokenPairSchema } from "@platform/contracts";
import { getApiBaseUrl } from "../lib/apiBase";
import { authFetch } from "../lib/authFetch";

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

/** Create, update, or remove (pin: null) the signed-in staff member's own login PIN. */
export async function setOwnPin(pin: string | null): Promise<void> {
  const res = await authFetch("/v1/users/me/pin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    if (res.status === 404) {
      throw new Error(
        "PIN management is not available on this server yet. The backend API needs to be updated (redeploy Railway), or switch to the local API for development.",
      );
    }
    throw new Error(err?.message ?? `Could not update PIN: ${res.status}`);
  }
}
