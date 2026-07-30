import type { TaxAuthorityFeatures } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { fetchTaxFeaturesNormalized } from "../../lib/praApi";
import { useSessionStore } from "../../stores/sessionStore";

/** Super Admin FBR/PRA flags for the signed-in business. */
export function useTaxAuthorityFeatures() {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["tax-authority", "features", accessToken],
    enabled: Boolean(accessToken),
    queryFn: fetchTaxFeaturesNormalized,
    staleTime: 60_000,
  });
}

export function isPraFakeEnabled(f: TaxAuthorityFeatures | undefined): boolean {
  return Boolean(f?.praFakeEnabled);
}

export function isPraRealEnabled(f: TaxAuthorityFeatures | undefined): boolean {
  return Boolean(f?.praRealEnabled);
}

export function isTaxAuthorityEnabled(
  features:
    | {
        fbrEnabled: boolean;
        praEnabled?: boolean;
        praFakeEnabled?: boolean;
        praRealEnabled?: boolean;
      }
    | undefined,
): boolean {
  return Boolean(
    features?.fbrEnabled ||
      features?.praEnabled ||
      features?.praFakeEnabled ||
      features?.praRealEnabled,
  );
}
