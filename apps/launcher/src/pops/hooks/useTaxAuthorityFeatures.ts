import { useQuery } from "@tanstack/react-query";
import { fetchTaxAuthorityFeatures } from "../../lib/taxAuthorityApi";
import { useSessionStore } from "../../stores/sessionStore";

/** Super Admin FBR/PRA flags for the signed-in business. */
export function useTaxAuthorityFeatures() {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["tax-authority", "features", accessToken],
    enabled: Boolean(accessToken),
    queryFn: fetchTaxAuthorityFeatures,
    staleTime: 60_000,
  });
}

export function isTaxAuthorityEnabled(features: { fbrEnabled: boolean; praEnabled: boolean } | undefined): boolean {
  return Boolean(features?.fbrEnabled || features?.praEnabled);
}
