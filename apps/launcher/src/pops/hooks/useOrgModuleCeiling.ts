import { orgModuleAccessSchema, type OrgModuleAccess } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { authFetch, refreshSessionPermissions } from "../../lib/authFetch";
import { isAccessTokenExpired } from "../../lib/jwt";
import { useSessionStore } from "../../stores/sessionStore";

type ModuleAccessResult =
  | { status: "ok"; enabledModules: string[] | null }
  | { status: "missing" };

async function fetchOrgModuleAccess(): Promise<ModuleAccessResult> {
  const res = await authFetch("/v1/org/module-access");
  // Older hosted APIs omit this route — callers fall back to JWT ceiling.
  if (res.status === 404) {
    return { status: "missing" };
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Module access failed (${res.status})`);
  }
  const data: OrgModuleAccess = orgModuleAccessSchema.parse(await res.json());
  return { status: "ok", enabledModules: data.enabledModules };
}

/**
 * Live Super Admin org module ceiling for the signed-in business.
 * When `status === "ok"`, use `enabledModules` (null = all modules allowed).
 * When missing/loading/error, fall back to JWT-based ceiling in the nav.
 */
export function useOrgModuleCeiling(): {
  status: "loading" | "ok" | "missing" | "error";
  enabledModules: string[] | null;
} {
  const accessToken = useSessionStore((s) => s.accessToken);
  const refreshed = useRef(false);

  // Soft-refresh JWT when the access token is near expiry / on focus so Super
  // Admin module ceilings stay current. Do not refresh immediately on every
  // fresh login — a failed refresh must not kick Admin back to role select.
  useEffect(() => {
    if (!accessToken) return;
    let last = 0;
    const run = (force = false) => {
      const now = Date.now();
      if (!force && now - last < 30_000 && refreshed.current) return;
      last = now;
      void refreshSessionPermissions().then((ok) => {
        if (ok) refreshed.current = true;
      });
    };
    // Only proactive-refresh when access token is within ~2 minutes of expiry.
    if (isAccessTokenExpired(accessToken, 120)) run(true);
    const onFocus = () => run(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [accessToken]);

  const query = useQuery({
    queryKey: ["org", "module-access", accessToken],
    enabled: Boolean(accessToken),
    queryFn: fetchOrgModuleAccess,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  if (!accessToken) return { status: "missing", enabledModules: null };
  if (query.isLoading && query.data === undefined) {
    return { status: "loading", enabledModules: null };
  }
  if (query.isError) return { status: "error", enabledModules: null };
  if (query.data?.status === "missing") return { status: "missing", enabledModules: null };
  return {
    status: "ok",
    enabledModules: query.data?.enabledModules ?? null,
  };
}
