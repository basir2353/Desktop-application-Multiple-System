import {
  RESTAURANT_REPORT_DEFS,
  restaurantReportCatalogSchema,
  restaurantReportSchema,
  type RestaurantReport,
  type RestaurantReportCatalog,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";
import { buildClientRestaurantReport } from "../lib/clientRestaurantReports";

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const msg = Array.isArray(err?.message) ? err.message.join(", ") : err?.message;
  throw new Error(msg ?? `${fallback}: ${res.status}`);
}

function isNetworkOrMissingReport(status: number, message: string): boolean {
  if (status === 404 || status === 501 || status === 502) return true;
  return /Cannot GET|404|Failed to fetch|NetworkError|Load failed|network/i.test(message);
}

export const RESTAURANT_REPORTS = RESTAURANT_REPORT_DEFS.map((r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
}));

export type RestaurantReportQuery = {
  from?: string;
  to?: string;
  fromTime?: string;
  toTime?: string;
};

export async function fetchRestaurantReportCatalog(): Promise<RestaurantReportCatalog> {
  try {
    const res = await authFetch("/v1/reports/catalog");
    if (res.ok) return restaurantReportCatalogSchema.parse(await res.json());
  } catch {
    // fall through to local catalog
  }
  return {
    reports: RESTAURANT_REPORTS.map((r) => ({ id: r.id, name: r.name, category: r.category })),
  };
}

export async function fetchRestaurantReport(
  branchCode: string,
  reportId: string,
  options?: RestaurantReportQuery,
): Promise<RestaurantReport> {
  const params = new URLSearchParams({ branchCode });
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.fromTime) params.set("fromTime", options.fromTime);
  if (options?.toTime) params.set("toTime", options.toTime);

  try {
    const res = await authFetch(`/v1/reports/${reportId}?${params}`);
    if (res.ok) {
      const report = restaurantReportSchema.parse(await res.json());
      // Prefer local aggregate until Railway cash-report includes delivery/discount/canceled.
      const cashNeedsUpgrade =
        reportId === "cash-report" &&
        !report.rows.some(
          (r) =>
            r.section === "deliveryCharges" ||
            r.section === "discount" ||
            r.section === "canceledOrders" ||
            /delivery charge|discount given|canceled orders/i.test(r.label),
        );
      const inOutNeedsUpgrade =
        reportId === "in-out" &&
        !report.rows.some((r) => r.section === "cashIn" || r.section === "net");
      if (cashNeedsUpgrade || inOutNeedsUpgrade) {
        try {
          return await buildClientRestaurantReport(branchCode, reportId, options);
        } catch {
          return report;
        }
      }
      // HTTP 200 empty is real API data for this org/branch — do not replace with client zeros.
      return report;
    }
    if (isNetworkOrMissingReport(res.status, "")) {
      return buildClientRestaurantReport(branchCode, reportId, options);
    }
    await parseError(res, "Report failed");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isNetworkOrMissingReport(0, message)) {
      return buildClientRestaurantReport(branchCode, reportId, options);
    }
    throw err instanceof Error ? err : new Error(message);
  }

  return buildClientRestaurantReport(branchCode, reportId, options);
}
