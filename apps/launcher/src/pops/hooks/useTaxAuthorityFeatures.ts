import type { TaxAuthorityFeatures } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { fetchTaxFeaturesNormalized } from "../../lib/praApi";
import { useSessionStore } from "../../stores/sessionStore";

/** Super Admin FBR/PRA flags for the signed-in business. */
export function useTaxAuthorityFeatures() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const organizationId = useSessionStore((s) => s.claims?.organizationId);
  return useQuery({
    queryKey: ["tax-authority", "features", organizationId, accessToken],
    enabled: Boolean(accessToken && organizationId),
    queryFn: fetchTaxFeaturesNormalized,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export function isPraFakeEnabled(f: TaxAuthorityFeatures | undefined): boolean {
  return Boolean(f?.praFakeEnabled);
}

export function isPraRealEnabled(f: TaxAuthorityFeatures | undefined): boolean {
  return Boolean(f?.praRealEnabled);
}

/** Tax module / page available when Super Admin showed at least one section. */
export function isTaxAuthorityEnabled(
  features:
    | {
        fbrAllowed?: boolean;
        praFakeAllowed?: boolean;
        praRealAllowed?: boolean;
        fbrEnabled?: boolean;
        praEnabled?: boolean;
        praFakeEnabled?: boolean;
        praRealEnabled?: boolean;
      }
    | undefined,
): boolean {
  return Boolean(
    features?.fbrAllowed ||
      features?.praFakeAllowed ||
      features?.praRealAllowed ||
      features?.fbrEnabled ||
      features?.praEnabled ||
      features?.praFakeEnabled ||
      features?.praRealEnabled,
  );
}

export function isFbrSectionAllowed(f: TaxAuthorityFeatures | undefined): boolean {
  return Boolean(f?.fbrAllowed || f?.fbrEnabled);
}

export function isPraFakeSectionAllowed(f: TaxAuthorityFeatures | undefined): boolean {
  return Boolean(f?.praFakeAllowed || f?.praFakeEnabled);
}

export function isPraRealSectionAllowed(f: TaxAuthorityFeatures | undefined): boolean {
  return Boolean(f?.praRealAllowed || f?.praRealEnabled);
}
