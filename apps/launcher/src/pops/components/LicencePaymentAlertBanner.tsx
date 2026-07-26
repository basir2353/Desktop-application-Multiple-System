import { Button } from "@platform/ui";
import { orgAlertSchema, type OrgAlert } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "../../lib/authFetch";
import { useSessionStore } from "../../stores/sessionStore";
import { sessionCanManageUsers } from "../lib/roleAccess";

async function fetchOrgAlerts(): Promise<OrgAlert[]> {
  const res = await authFetch("/v1/org/alerts");
  if (res.status === 403) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Alerts failed (${res.status})`);
  }
  const json: unknown = await res.json();
  return orgAlertSchema.array().parse(json);
}

async function dismissOrgAlert(alertId: string): Promise<void> {
  const res = await authFetch(`/v1/org/alerts/${alertId}/dismiss`, { method: "POST" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Dismiss failed (${res.status})`);
  }
}

/** Sticky payment/licence alerts — business admin only (desktop app). */
export function LicencePaymentAlertBanner(): JSX.Element | null {
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const role = (claims?.role ?? "").toLowerCase();
  const isAdmin =
    Boolean(accessToken) &&
    claims?.platformRole !== "super_admin" &&
    (role === "admin" || role === "owner" || sessionCanManageUsers(claims));

  const qc = useQueryClient();
  const alerts = useQuery({
    queryKey: ["org", "alerts"],
    queryFn: fetchOrgAlerts,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const dismissMut = useMutation({
    mutationFn: dismissOrgAlert,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["org", "alerts"] });
    },
  });

  if (!isAdmin) return null;
  const list = alerts.data ?? [];
  if (list.length === 0) return null;

  return (
    <div className="space-y-2 border-b border-amber-300/80 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/50 md:px-6">
      {list.map((alert) => (
        <div
          key={alert.id}
          className="flex flex-wrap items-start justify-between gap-3 text-sm text-amber-950 dark:text-amber-100"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{alert.title}</p>
            <p className="mt-0.5 text-amber-900/90 dark:text-amber-200/90">{alert.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 text-xs text-amber-900 dark:text-amber-100"
            disabled={dismissMut.isPending}
            onClick={() => dismissMut.mutate(alert.id)}
          >
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  );
}
