import { type Bill, type KitchenTicket, type MenuItem } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useLiveRefetchInterval } from "../src/hooks/useLiveRefetchInterval";
import { fetchOrders } from "../src/api/billing";
import { fetchKitchenTickets } from "../src/api/kitchen";
import { fetchBranchMenu } from "../src/api/menu";
import {
  Card,
  Chip,
  EmptyState,
  Label,
  Muted,
  Notice,
  Screen,
  StatusBadge,
  Subtitle,
  colors,
} from "../src/components/ui";
import { canEditKitchenTicket, canTransferKitchenTicket, ownsKitchenTicket } from "../src/lib/loadOrder";
import {
  formatTimeAgo,
  formatPkr,
  kitchenStatusLabel,
  orderRefFromTicket,
} from "../src/lib/orderDisplay";
import { filterActiveKitchenTickets, kitchenTicketTotal } from "../src/lib/orderHistory";
import { printBillReceipt, printCartBill, printKitchenOrder } from "../src/lib/printBill";
import { inferOrderModeFromStation } from "../src/lib/orderMode";
import { resolveStaffRole } from "../src/lib/roles";
import { calcServiceTaxTotals, DEFAULT_POS_TAX_SETTINGS, posTaxSettingsFromApi } from "../src/lib/posTaxSettings";
import { fetchTaxSettings } from "../src/api/accounting";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";
import type { PosTaxSettings } from "../src/lib/posTaxSettings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrdersTab = "active" | "paid";

function ticketBillLines(
  ticket: KitchenTicket,
  menuItems: MenuItem[],
  taxSettings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS,
) {
  const lines = (ticket.lines ?? []).map((line) => {
    const id = String(line.menuItemId ?? "").trim();
    return {
      label: line.label,
      qty: Math.max(1, Math.round(Number(line.qty) || 1)),
      unitPrice: Math.max(0, Math.round(Number(line.unitPrice) || 0)),
      ...(UUID_RE.test(id) ? { menuItemId: id } : {}),
    };
  });
  if (lines.length > 0) return lines;
  const subtotal = kitchenTicketTotal(ticket, menuItems, taxSettings) ?? 0;
  return [{ label: ticket.itemsSummary || "Order", qty: 1, unitPrice: Math.max(0, subtotal) }];
}

function ticketCheckoutTotal(
  ticket: KitchenTicket,
  menuItems: MenuItem[],
  method: "cash" | "card",
  taxSettings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS,
) {
  const lines = ticketBillLines(ticket, menuItems, taxSettings);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const delivery =
    inferOrderModeFromStation(ticket.stationLabel) === "delivery"
      ? Math.max(0, Number(ticket.deliveryChargePkr) || 0)
      : 0;
  const totals = calcServiceTaxTotals(
    subtotal,
    taxSettings,
    method,
    inferOrderModeFromStation(ticket.stationLabel),
  );
  return {
    lines,
    subtotal,
    ...totals,
    deliveryChargePkr: delivery,
    total: totals.total + delivery,
  };
}

export default function OrdersScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";
  const [tab, setTab] = useState<OrdersTab>("active");
  const [notice, setNotice] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const printLockRef = useRef<Set<string>>(new Set());

  const kitchenPoll = useLiveRefetchInterval(15_000);
  const ordersPoll = useLiveRefetchInterval(20_000);

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: kitchenPoll,
    staleTime: 10_000,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchOrders(branchCode),
    refetchInterval: ordersPoll,
    staleTime: 15_000,
  });

  const menuQuery = useQuery({
    queryKey: ["menu", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchMenu(branchCode),
    staleTime: 5 * 60_000,
  });

  const posTaxQuery = useQuery({
    queryKey: ["pos-tax-settings", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchTaxSettings(branchCode),
    staleTime: 30_000,
  });
  const TAX_SETTINGS = posTaxQuery.data
    ? posTaxSettingsFromApi(posTaxQuery.data)
    : DEFAULT_POS_TAX_SETTINGS;

  const menuItems = menuQuery.data?.items ?? [];
  const tickets = [...(kitchenQuery.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const bills = ordersQuery.data ?? [];
  const active = filterActiveKitchenTickets(tickets, bills);
  const ready = active.filter((t) => t.status === "ready");
  const paidBills = useMemo(
    () =>
      [...bills]
        .filter((b) => b.status === "completed")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [bills],
  );

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (resolveStaffRole(claims) === "rider") {
    return <Redirect href="/rider-home" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  function openEdit(ticket: KitchenTicket): void {
    router.push({ pathname: "/order", params: { editTicketId: ticket.id } });
  }

  function openTransfer(ticket: KitchenTicket): void {
    router.push({ pathname: "/table-transfer", params: { ticketId: ticket.id } });
  }

  async function withPrintLock(key: string, run: () => Promise<void>): Promise<void> {
    if (printLockRef.current.has(key) || printingId) return;
    printLockRef.current.add(key);
    setPrintingId(key);
    setNotice(null);
    try {
      await run();
    } finally {
      printLockRef.current.delete(key);
      setPrintingId(null);
    }
  }

  async function handlePrint(ticket: KitchenTicket): Promise<void> {
    if (!branch) return;
    await withPrintLock(ticket.id, async () => {
      const ok = await printKitchenOrder(branch.name, branch.code, ticket, menuItems);
      setNotice(
        ok
          ? `Print order sent for ${orderRefFromTicket(ticket)}.`
          : `Could not print ${orderRefFromTicket(ticket)}.`,
      );
    });
  }

  async function handlePrintBill(ticket: KitchenTicket): Promise<void> {
    if (!branch) return;
    await withPrintLock(`bill-${ticket.id}`, async () => {
      const checkout = ticketCheckoutTotal(ticket, menuItems, "cash", TAX_SETTINGS);
      const ok = await printCartBill({
        branchName: branch.name,
        branchCode: branch.code,
        orderRef: orderRefFromTicket(ticket),
        tableLabel: ticket.stationLabel,
        waiterName: ticket.createdByName,
        lines: checkout.lines,
        subtotal: checkout.subtotal,
        service: checkout.service,
        servicePct: checkout.servicePct,
        tax: checkout.tax,
        taxPct: checkout.taxPct,
        total: checkout.total,
        deliveryChargePkr: checkout.deliveryChargePkr,
        cashTaxPct: checkout.cashTaxPct,
        cardTaxPct: checkout.cardTaxPct,
        cashTax: checkout.cashTax,
        cardTax: checkout.cardTax,
        cashTotal: checkout.cashTotal + checkout.deliveryChargePkr,
        cardTotal: checkout.cardTotal + checkout.deliveryChargePkr,
      });
      setNotice(ok ? `Bill sent for ${orderRefFromTicket(ticket)}.` : `Could not print bill.`);
    });
  }

  async function handlePrintPaidBill(bill: Bill): Promise<void> {
    if (!branch) return;
    await withPrintLock(`paid-${bill.id}`, async () => {
      const ok = await printBillReceipt(branch.name, branch.code, bill, { embedPra: false });
      setNotice(ok ? `Bill for ${bill.billRef} sent to printer.` : `Could not print ${bill.billRef}.`);
    });
  }

  const refreshing =
    tab === "active" ? kitchenQuery.isFetching : ordersQuery.isFetching || kitchenQuery.isFetching;

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void kitchenQuery.refetch();
              void ordersQuery.refetch();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip
            label={`Active · ${active.length}`}
            selected={tab === "active"}
            onPress={() => setTab("active")}
          />
          <Chip
            label={`Paid · ${paidBills.length}`}
            selected={tab === "paid"}
            onPress={() => setTab("paid")}
          />
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.push("/table-transfer")} style={{ justifyContent: "center" }}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>Transfer</Text>
          </Pressable>
        </View>

        <Subtitle>
          {tab === "active"
            ? `${active.length} active order${active.length === 1 ? "" : "s"}${
                ready.length > 0 ? ` · ${ready.length} ready` : ""
              }`
            : `${paidBills.length} paid order${paidBills.length === 1 ? "" : "s"}`}
        </Subtitle>

        {notice ? (
          <Notice
            tone={
              notice.includes("sent") || notice.includes("printed") ? "success" : "warning"
            }
          >
            {notice}
          </Notice>
        ) : null}

        {tab === "active" ? (
          kitchenQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : active.length === 0 ? (
            <Card>
              <EmptyState
                title="No active orders"
                message="When you send orders from Take order, they will appear here with live kitchen status."
              />
              <Pressable
                onPress={() => router.push("/order")}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: 10,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.accentText, fontWeight: "700" }}>Take order</Text>
              </Pressable>
            </Card>
          ) : (
            active.map((ticket) => {
              const canEdit = canEditKitchenTicket(ticket) && ownsKitchenTicket(ticket, claims?.sub);
              const canTransfer = canTransferKitchenTicket(ticket, claims?.sub);
              const isDineIn = inferOrderModeFromStation(ticket.stationLabel) === "dine-in";
              const isPrinting = printingId === ticket.id;
              const isPrintingBill = printingId === `bill-${ticket.id}`;
              return (
                <Card key={ticket.id}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 15, fontWeight: "700" }}>
                      {orderRefFromTicket(ticket)}
                    </Text>
                    <StatusBadge status={kitchenStatusLabel(ticket.status)} />
                  </View>
                  <Label>
                    {ticket.stationLabel}
                    {ticket.createdByName ? ` · by ${ticket.createdByName}` : ""}
                  </Label>
                  <Muted>{ticket.itemsSummary}</Muted>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Muted>{formatTimeAgo(ticket.createdAt)}</Muted>
                    <Muted>
                      {ticket.mins} min · {ticket.ticketRef}
                    </Muted>
                  </View>
                  {(() => {
                    const total = kitchenTicketTotal(ticket, menuItems, TAX_SETTINGS);
                    return (
                      <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "700", marginTop: 4 }}>
                        {total != null ? formatPkr(total) : "—"}
                      </Text>
                    );
                  })()}
                  {ticket.priority === "priority" ? (
                    <Text style={{ color: colors.warning, fontSize: 13 }}>Priority order</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={() => void handlePrint(ticket)}
                      disabled={Boolean(printingId)}
                      style={{
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.bg,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        opacity: isPrinting ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {isPrinting ? "Printing…" : "Print order"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handlePrintBill(ticket)}
                      disabled={Boolean(printingId)}
                      style={{
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "rgba(16, 185, 129, 0.45)",
                        backgroundColor: "rgba(16, 185, 129, 0.12)",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        opacity: isPrintingBill ? 0.6 : 1,
                      }}
                    >
                      <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>
                        {isPrintingBill ? "Printing…" : "Print bill"}
                      </Text>
                    </Pressable>
                    {canEdit ? (
                      <Pressable
                        onPress={() => openEdit(ticket)}
                        style={{
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "rgba(15, 118, 110, 0.45)",
                          backgroundColor: "rgba(15, 118, 110, 0.12)",
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>Edit order</Text>
                      </Pressable>
                    ) : null}
                    {canTransfer ? (
                      <Pressable
                        onPress={() => openTransfer(ticket)}
                        style={{
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "rgba(56, 189, 248, 0.45)",
                          backgroundColor: "rgba(56, 189, 248, 0.12)",
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={{ color: "#38bdf8", fontWeight: "700", fontSize: 13 }}>
                          Table transfer
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {!ownsKitchenTicket(ticket, claims?.sub) ? (
                    <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "600", marginTop: 6 }}>
                      Taken by {ticket.createdByName ?? "another waiter"} — view only
                    </Text>
                  ) : !isDineIn && canEdit ? (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                      Table transfer is only for dine-in orders
                    </Text>
                  ) : null}
                </Card>
              );
            })
          )
        ) : ordersQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : paidBills.length === 0 ? (
          <Card>
            <EmptyState
              title="No paid orders"
              message="Paid bills from the cashier appear here. Use Print bill to reprint."
            />
          </Card>
        ) : (
          paidBills.map((bill) => {
            const isPrintingPaid = printingId === `paid-${bill.id}`;
            return (
              <Card key={bill.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 15, fontWeight: "700" }}>
                    {bill.orderRef ?? bill.billRef}
                  </Text>
                  <StatusBadge status="Paid" />
                </View>
                <Label>
                  {bill.tableLabel}
                  {bill.waiterName ? ` · by ${bill.waiterName}` : ""}
                </Label>
                <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={3}>
                  {(bill.lines ?? []).map((l) => `${l.label} x${l.qty}`).join(", ") || bill.billRef}
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Muted>{formatTimeAgo(bill.createdAt)}</Muted>
                  <Muted>{bill.billRef}</Muted>
                </View>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "700", marginTop: 4 }}>
                  {formatPkr(bill.total)}
                </Text>
                {bill.praInvoiceNumber?.trim() ? (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    PRA Invoice # {bill.praInvoiceNumber.trim()}
                    {bill.praMode === "real" ? " · Real" : ""}
                    {bill.praMode === "fake" ? " · FPRA" : ""}
                  </Text>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => void handlePrintPaidBill(bill)}
                    disabled={Boolean(printingId)}
                    style={{
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "rgba(16, 185, 129, 0.45)",
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      opacity: isPrintingPaid ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: colors.success, fontWeight: "700", fontSize: 13 }}>
                      {isPrintingPaid ? "Printing…" : "Print bill"}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
