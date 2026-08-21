import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdaptiveRefetchInterval } from "../../lib/useAdaptiveRefetchInterval";
import { authFetch } from "../../lib/authFetch";
import { useActiveSystemId } from "../../hooks/useActiveSystemId";
import { usePopsStore } from "../../stores/popsStore";
import { fetchBranchInventory } from "../api/inventory";
import { fetchKitchenTickets } from "../api/kitchen";
import {
  KITCHEN_SLOW_ALERT_MINS,
  KITCHEN_SLOW_WARN_MINS,
  kitchenAlertsFromTickets,
  mergeAlerts,
  newOrderAlert,
  type PopsAlert,
} from "../lib/popsAlerts";
import {
  printAlertsFromState,
  PRINT_HISTORY_CHANGED_EVENT,
  PRINT_QUEUE_MONITOR_CHANGED,
  type QueueJobSnapshot,
} from "../lib/printQueueMonitor";
import {
  loadStockAlertSettings,
  STOCK_ALERT_SETTINGS_CHANGED_EVENT,
  type StockAlertSettings,
} from "../lib/stockAlertSettings";

export type PopsToast = PopsAlert & { toastId: string };

const TOAST_TTL_MS = 8_000;

function stockAlertsFromIngredients(
  ingredients: {
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    reorderLevel: number;
  }[],
  settings: StockAlertSettings,
): PopsAlert[] {
  if (!settings.autoNotifyEnabled) return [];
  const now = new Date().toISOString();
  const limitExtra = settings.notifyBufferQty;
  return ingredients
    .filter((ing) => ing.currentStock <= ing.reorderLevel + limitExtra)
    .map((ing) => {
      const out = ing.currentStock <= 0;
      return {
        id: `stock-${ing.id}-${ing.currentStock}-${ing.reorderLevel + limitExtra}`,
        kind: "low_stock" as const,
        tone: out ? ("danger" as const) : ("warning" as const),
        title: out ? "Out of stock" : "Low stock",
        message: `${ing.name} — ${ing.currentStock} ${ing.unit} (alert at ${ing.reorderLevel + limitExtra} ${ing.unit})`,
        href: "/pops/inventory/ingredients",
        at: now,
      };
    });
}

async function fetchPrintQueueSnapshots(branchCode: string): Promise<QueueJobSnapshot[]> {
  const jobs: QueueJobSnapshot[] = [];

  try {
    const { listBranchPrintQueue } = await import("../lib/branchPrintClient");
    const rows = await listBranchPrintQueue(branchCode);
    for (const row of rows) {
      let kind: string | null = null;
      try {
        const payload = JSON.parse(row.payloadJson || "{}") as { kind?: string };
        kind = payload.kind ?? null;
      } catch {
        kind = null;
      }
      jobs.push({
        id: row.id,
        branchCode,
        status: row.status,
        kind,
        printerName: row.printerName,
        orderId: row.orderId,
        error: row.error,
        deviceLabel: row.deviceLabel,
        updatedAt: row.updatedAt ?? row.createdAt ?? null,
        source: "local",
      });
    }
  } catch {
    // ignore
  }

  try {
    const res = await authFetch(`/v1/printing/queue?branchCode=${encodeURIComponent(branchCode)}`);
    if (res.ok) {
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      for (const r of Array.isArray(rows) ? rows : []) {
        jobs.push({
          id: String(r.id ?? ""),
          branchCode,
          status: String(r.status ?? ""),
          kind: (r.kind ?? r.jobKind ?? null) as string | null,
          printerName: (r.printerName ?? r.printer_name ?? null) as string | null,
          orderId: (r.orderId ?? r.order_id ?? null) as string | null,
          error: (r.error ?? null) as string | null,
          deviceLabel: (r.deviceLabel ?? r.device_label ?? null) as string | null,
          updatedAt: (r.updatedAt ?? r.updated_at ?? null) as string | null,
          source: "cloud",
        });
      }
    }
  } catch {
    // ignore
  }

  return jobs;
}

export function usePopsAlerts(): {
  alerts: PopsAlert[];
  toasts: PopsToast[];
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;
  unreadCount: number;
  isLoading: boolean;
} {
  const branch = usePopsStore((s) => s.branch);
  const systemId = useActiveSystemId();
  const restaurantAlerts = systemId === "restaurant";
  const kitchenPollMs = useAdaptiveRefetchInterval(5_000);
  const inventoryPollMs = useAdaptiveRefetchInterval(30_000);
  const printPollMs = useAdaptiveRefetchInterval(8_000);
  const [toasts, setToasts] = useState<PopsToast[]>([]);
  const [printMonitorTick, setPrintMonitorTick] = useState(0);
  const [stockSettings, setStockSettings] = useState<StockAlertSettings>(() =>
    loadStockAlertSettings(branch?.code),
  );

  const prevTicketIdsRef = useRef<Set<string>>(new Set());
  const prevStockAlertIdsRef = useRef<Set<string>>(new Set());
  const prevPrintAlertIdsRef = useRef<Set<string>>(new Set());
  const toastedKeysRef = useRef<Set<string>>(new Set());
  const kitchenInitializedRef = useRef(false);
  const stockInitializedRef = useRef(false);
  const printInitializedRef = useRef(false);

  useEffect(() => {
    setStockSettings(loadStockAlertSettings(branch?.code));
  }, [branch?.code]);

  useEffect(() => {
    function onSettingsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setStockSettings(loadStockAlertSettings(branch?.code));
      }
    }
    window.addEventListener(STOCK_ALERT_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () => window.removeEventListener(STOCK_ALERT_SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, [branch?.code]);

  useEffect(() => {
    function bump(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || !detail?.branchCode || detail.branchCode === branch.code) {
        setPrintMonitorTick((n) => n + 1);
      }
    }
    window.addEventListener(PRINT_HISTORY_CHANGED_EVENT, bump);
    window.addEventListener(PRINT_QUEUE_MONITOR_CHANGED, bump);
    return () => {
      window.removeEventListener(PRINT_HISTORY_CHANGED_EVENT, bump);
      window.removeEventListener(PRINT_QUEUE_MONITOR_CHANGED, bump);
    };
  }, [branch?.code]);

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: restaurantAlerts && Boolean(branch?.code),
    queryFn: () => fetchKitchenTickets(branch!.code),
    refetchInterval: restaurantAlerts ? kitchenPollMs : false,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: restaurantAlerts && Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
    refetchInterval: restaurantAlerts ? inventoryPollMs : false,
  });

  const printQueueQuery = useQuery({
    queryKey: ["print-queue-alerts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPrintQueueSnapshots(branch!.code),
    refetchInterval: branch?.code ? printPollMs : false,
  });

  const tickets = kitchenQuery.data ?? [];

  const printAlerts = useMemo(() => {
    void printMonitorTick;
    return printAlertsFromState({
      branchCode: branch?.code,
      queueJobs: printQueueQuery.data ?? [],
    });
  }, [branch?.code, printMonitorTick, printQueueQuery.data]);

  const alerts = useMemo(() => {
    const kitchen = restaurantAlerts ? kitchenAlertsFromTickets(tickets) : [];
    const stock = restaurantAlerts
      ? stockAlertsFromIngredients(inventoryQuery.data?.ingredients ?? [], stockSettings)
      : [];
    return mergeAlerts(kitchen, stock, printAlerts);
  }, [tickets, inventoryQuery.data, stockSettings, printAlerts, restaurantAlerts]);

  const unreadCount = alerts.length;

  function pushToast(alert: PopsAlert, toastKey: string): void {
    if (toastedKeysRef.current.has(toastKey)) return;
    toastedKeysRef.current.add(toastKey);

    const toastId = `${toastKey}-${Date.now()}`;
    setToasts((prev) => [{ ...alert, toastId }, ...prev].slice(0, 5));

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    }, TOAST_TTL_MS);
  }

  useEffect(() => {
    if (!branch?.code) {
      setToasts([]);
      return;
    }

    prevTicketIdsRef.current = new Set();
    prevStockAlertIdsRef.current = new Set();
    prevPrintAlertIdsRef.current = new Set();
    toastedKeysRef.current = new Set();
    kitchenInitializedRef.current = false;
    stockInitializedRef.current = false;
    printInitializedRef.current = false;
    setToasts([]);
  }, [branch?.code, restaurantAlerts]);

  useEffect(() => {
    if (!restaurantAlerts || !kitchenQuery.data) return;

    const currentIds = new Set(kitchenQuery.data.map((t) => t.id));

    if (!kitchenInitializedRef.current) {
      prevTicketIdsRef.current = currentIds;
      kitchenInitializedRef.current = true;
      return;
    }

    for (const ticket of kitchenQuery.data) {
      if (!prevTicketIdsRef.current.has(ticket.id)) {
        const alert = newOrderAlert(ticket);
        pushToast(alert, `new-${ticket.id}`);
      }
    }

    for (const ticket of kitchenQuery.data) {
      if (ticket.status === "done") continue;
      if (ticket.mins >= KITCHEN_SLOW_ALERT_MINS) {
        pushToast(
          {
            id: `kitchen-slow-${ticket.id}`,
            kind: "kitchen_slow",
            tone: "danger",
            title: "Kitchen delay",
            message: `${ticket.ticketRef} waiting ${ticket.mins} min`,
            href: "/pops/kitchen",
            at: new Date().toISOString(),
          },
          `slow-${ticket.id}-${KITCHEN_SLOW_ALERT_MINS}`,
        );
      } else if (ticket.mins >= KITCHEN_SLOW_WARN_MINS) {
        pushToast(
          {
            id: `kitchen-warn-${ticket.id}`,
            kind: "kitchen_slow",
            tone: "warning",
            title: "Order taking long",
            message: `${ticket.ticketRef} in kitchen ${ticket.mins} min`,
            href: "/pops/kitchen",
            at: new Date().toISOString(),
          },
          `slow-${ticket.id}-${KITCHEN_SLOW_WARN_MINS}`,
        );
      }
    }

    prevTicketIdsRef.current = currentIds;
  }, [kitchenQuery.data, branch?.code, restaurantAlerts]);

  useEffect(() => {
    if (!restaurantAlerts || !inventoryQuery.data) return;
    if (!stockSettings.autoNotifyEnabled) {
      prevStockAlertIdsRef.current = new Set();
      stockInitializedRef.current = true;
      return;
    }

    const stockAlerts = stockAlertsFromIngredients(inventoryQuery.data.ingredients, stockSettings);
    const currentIds = new Set(stockAlerts.map((a) => a.id));

    if (!stockInitializedRef.current) {
      prevStockAlertIdsRef.current = currentIds;
      stockInitializedRef.current = true;
      return;
    }

    for (const alert of stockAlerts) {
      if (!prevStockAlertIdsRef.current.has(alert.id)) {
        pushToast(alert, `stock-${alert.id}`);
      }
    }

    prevStockAlertIdsRef.current = currentIds;
  }, [inventoryQuery.data, branch?.code, restaurantAlerts, stockSettings]);

  useEffect(() => {
    if (!branch?.code) return;

    const currentIds = new Set(printAlerts.map((a) => a.id));

    if (!printInitializedRef.current) {
      prevPrintAlertIdsRef.current = currentIds;
      printInitializedRef.current = true;
      return;
    }

    for (const alert of printAlerts) {
      if (!prevPrintAlertIdsRef.current.has(alert.id)) {
        pushToast(alert, `print-${alert.id}`);
      }
    }

    prevPrintAlertIdsRef.current = currentIds;
  }, [printAlerts, branch?.code]);

  function dismissToast(toastId: string): void {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }

  function clearToasts(): void {
    setToasts([]);
  }

  return {
    alerts,
    toasts,
    dismissToast,
    clearToasts,
    unreadCount,
    isLoading: kitchenQuery.isLoading,
  };
}
