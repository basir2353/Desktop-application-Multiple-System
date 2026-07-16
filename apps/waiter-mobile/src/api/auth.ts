import { authFetch } from "../lib/authFetch";

export { passwordLogin, pinLogin, refreshSession } from "../lib/sessionAuth";

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
