import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePopsStore } from "../../stores/popsStore";
import { fetchInventoryDashboard } from "../api/inventory";
import { fetchKitchenTickets } from "../api/kitchen";
import {
  inventoryAlertsFromDashboard,
  KITCHEN_SLOW_ALERT_MINS,
  KITCHEN_SLOW_WARN_MINS,
  kitchenAlertsFromTickets,
  mergeAlerts,
  newOrderAlert,
  type PopsAlert,
} from "../lib/popsAlerts";

export type PopsToast = PopsAlert & { toastId: string };

const TOAST_TTL_MS = 8_000;

export function usePopsAlerts(): {
  alerts: PopsAlert[];
  toasts: PopsToast[];
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;
  unreadCount: number;
  isLoading: boolean;
} {
  const branch = usePopsStore((s) => s.branch);
  const [toasts, setToasts] = useState<PopsToast[]>([]);

  const prevTicketIdsRef = useRef<Set<string>>(new Set());
  const prevStockAlertIdsRef = useRef<Set<string>>(new Set());
  const toastedKeysRef = useRef<Set<string>>(new Set());
  const kitchenInitializedRef = useRef(false);
  const stockInitializedRef = useRef(false);

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchKitchenTickets(branch!.code),
    refetchInterval: 5_000,
  });

  const inventoryQuery = useQuery({
    queryKey: ["inventory-dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryDashboard(branch!.code),
    refetchInterval: 30_000,
  });

  const tickets = kitchenQuery.data ?? [];

  const alerts = useMemo(() => {
    const kitchen = kitchenAlertsFromTickets(tickets);
    const stock = inventoryQuery.data ? inventoryAlertsFromDashboard(inventoryQuery.data) : [];
    return mergeAlerts(kitchen, stock);
  }, [tickets, inventoryQuery.data]);

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
    if (!branch?.code) return;

    prevTicketIdsRef.current = new Set();
    prevStockAlertIdsRef.current = new Set();
    toastedKeysRef.current = new Set();
    kitchenInitializedRef.current = false;
    stockInitializedRef.current = false;
    setToasts([]);
  }, [branch?.code]);

  useEffect(() => {
    if (!kitchenQuery.data) return;

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
  }, [kitchenQuery.data, branch?.code]);

  useEffect(() => {
    if (!inventoryQuery.data) return;

    const stockAlerts = inventoryAlertsFromDashboard(inventoryQuery.data);
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
  }, [inventoryQuery.data, branch?.code]);

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
