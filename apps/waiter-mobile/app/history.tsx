import { useQuery } from "@tanstack/react-query";
import type { Bill, KitchenTicket, MenuItem } from "@platform/contracts";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { fetchOrders } from "../src/api/billing";
import { fetchKitchenTickets } from "../src/api/kitchen";
import { fetchBranchMenu } from "../src/api/menu";
import {
  Card,
  Chip,
  EmptyState,
  Input,
  Notice,
  Screen,
  StatCard,
  StatusBadge,
  colors,
} from "../src/components/ui";
import { useThemedStyleSheet } from "../src/theme/useThemedStyleSheet";
import { formatPkr, formatTimeAgo, formatWhen, isToday } from "../src/lib/orderDisplay";
import { printBillReceipt, printCartBill, printKitchenOrder } from "../src/lib/printBill";
import {
  buildUnifiedOrders,
  canEditUnifiedOrder,
  kitchenTicketTotal,
  matchesOrderSearch,
  orderStatusAccent,
  unifiedOrderOwnerLabel,
  unifiedOrderRef,
  unifiedOrderStatus,
  unifiedOrderSummary,
  unifiedOrderTable,
  unifiedOrderTotal,
  type UnifiedOrder,
} from "../src/lib/orderHistory";
import { calcServiceTaxTotals, DEFAULT_POS_TAX_SETTINGS, posTaxSettingsFromApi } from "../src/lib/posTaxSettings";
import { fetchTaxSettings } from "../src/api/accounting";
import { inferOrderModeFromStation } from "../src/lib/orderMode";
import { useBranchStore } from "../src/stores/branchStore";
import { resolveStaffRole } from "../src/lib/roles";
import { useSessionStore } from "../src/stores/sessionStore";

type HistoryFilter = "today" | "all" | "held" | "paid";

export default function HistoryScreen() {
  const styles = useScreenStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";
  const [filter, setFilter] = useState<HistoryFilter>(
    params.filter === "held" ? "held" : "today",
  );
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const printLockRef = useRef<Set<string>>(new Set());

  const ordersQuery = useQuery({
    queryKey: ["orders", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchOrders(branchCode),
    refetchInterval: 15_000,
  });

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: 15_000,
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

  const unified = useMemo(
    () => buildUnifiedOrders(ordersQuery.data ?? [], kitchenQuery.data ?? []),
    [ordersQuery.data, kitchenQuery.data],
  );

  const filtered = useMemo(() => {
    let list = unified;
    if (filter === "today") {
      list = list.filter((order) => isToday(order.createdAt));
    } else if (filter === "held") {
      list = list.filter((order) => order.source === "bill" && order.bill.status === "held");
    } else if (filter === "paid") {
      list = list.filter((order) => order.source === "bill" && order.bill.status === "completed");
    }
    if (search.trim()) {
      list = list.filter((order) => matchesOrderSearch(order, search));
    }
    return list;
  }, [unified, filter, search]);

  const kitchenCount = filtered.filter((order) => order.source === "kitchen").length;
  const billCount = filtered.filter((order) => order.source === "bill").length;
  const loading = ordersQuery.isLoading || kitchenQuery.isLoading;
  const refreshing = ordersQuery.isFetching || kitchenQuery.isFetching;
  const queryError =
    (ordersQuery.error as Error | null)?.message ??
    (kitchenQuery.error as Error | null)?.message ??
    null;

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (resolveStaffRole(claims) === "rider") {
    return <Redirect href="/rider-home" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  function refreshAll(): void {
    void ordersQuery.refetch();
    void kitchenQuery.refetch();
  }

  async function withPrintLock(key: string, run: () => Promise<void>): Promise<void> {
    if (printLockRef.current.has(key) || printingId) return;
    printLockRef.current.add(key);
    setPrintingId(key);
    try {
      await run();
    } finally {
      printLockRef.current.delete(key);
      setPrintingId(null);
    }
  }

  async function handlePrint(bill: Bill): Promise<void> {
    if (!branch) return;
    await withPrintLock(`bill-${bill.id}`, async () => {
      const ok = await printBillReceipt(branch.name, branch.code, bill, { embedPra: false });
      setNotice(ok ? `Bill for ${bill.billRef} sent to printer.` : `Could not print ${bill.billRef}.`);
    });
  }

  async function handlePrintKitchen(ticket: KitchenTicket): Promise<void> {
    if (!branch) return;
    await withPrintLock(`kot-${ticket.id}`, async () => {
      const ok = await printKitchenOrder(branch.name, branch.code, ticket, menuItems);
      setNotice(
        ok
          ? `Print order sent for ${ticket.orderRef ?? ticket.ticketRef}.`
          : `Could not print ${ticket.orderRef ?? ticket.ticketRef}.`,
      );
    });
  }

  async function handlePrintKitchenBill(ticket: KitchenTicket): Promise<void> {
    if (!branch) return;
    await withPrintLock(`kbill-${ticket.id}`, async () => {
      const lines = (ticket.lines ?? []).map((line) => ({
        label: line.label,
        qty: line.qty,
        unitPrice: line.unitPrice ?? 0,
      }));
      const subtotal =
        lines.length > 0
          ? lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)
          : kitchenTicketTotal(ticket, menuItems, TAX_SETTINGS) ?? 0;
      const totals = calcServiceTaxTotals(
        subtotal,
        TAX_SETTINGS,
        "cash",
        inferOrderModeFromStation(ticket.stationLabel),
      );
      const ok = await printCartBill({
        branchName: branch.name,
        branchCode: branch.code,
        orderRef: ticket.orderRef ?? ticket.ticketRef,
        tableLabel: ticket.stationLabel,
        waiterName: ticket.createdByName,
        lines:
          lines.length > 0
            ? lines
            : [{ label: ticket.itemsSummary || "Order", qty: 1, unitPrice: subtotal }],
        subtotal,
        service: totals.service,
        servicePct: totals.servicePct,
        tax: totals.tax,
        taxPct: totals.taxPct,
        total: totals.total,
        cashTaxPct: totals.cashTaxPct,
        cardTaxPct: totals.cardTaxPct,
        cashTax: totals.cashTax,
        cardTax: totals.cardTax,
        cashTotal: totals.cashTotal,
        cardTotal: totals.cardTotal,
      });
      setNotice(
        ok
          ? `Bill sent for ${ticket.orderRef ?? ticket.ticketRef}.`
          : `Could not print bill for ${ticket.orderRef ?? ticket.ticketRef}.`,
      );
    });
  }

  function openEdit(order: UnifiedOrder): void {
    if (order.source === "kitchen") {
      router.push({ pathname: "/order", params: { editTicketId: order.ticket.id } });
      return;
    }
    router.push({ pathname: "/order", params: { editBillId: order.bill.id } });
  }

  const filters: { id: HistoryFilter; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "all", label: "All" },
    { id: "paid", label: "Paid" },
    { id: "held", label: "On hold" },
  ];

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.accent} />
        }
      >
        <View style={styles.topBar}>
          <View style={styles.topBarCopy}>
            <Text style={styles.branchName}>{branch.name}</Text>
            <Text style={styles.branchMeta}>Order history · {branch.code}</Text>
          </View>
        </View>

        {queryError ? <Notice tone="warning">{queryError}</Notice> : null}
        {notice ? (
          <Notice
            tone={
              notice.includes("success") || notice.includes("printed") ? "success" : "warning"
            }
          >
            {notice}
          </Notice>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard
            label="Showing"
            value={filtered.length}
            hint={`${kitchenCount} kitchen · ${billCount} bills`}
          />
        </View>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <Input
            placeholder="Search ref, table, items, status…"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.trim() ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Text style={styles.clearSearch}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading orders…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              title={search.trim() ? "No matches" : "No orders found"}
              message={
                search.trim()
                  ? "Try a different search term or clear the filter."
                  : filter === "today"
                    ? "Kitchen tickets and bills from today will appear here."
                    : filter === "held"
                      ? "Held bills waiting for payment appear here."
                      : filter === "paid"
                        ? "Completed / paid bills appear here."
                        : "Your branch order history will appear here."
              }
            />
          </Card>
        ) : (
          <View style={styles.list}>
            {filtered.map((order) => (
              <OrderHistoryCard
                key={`${order.source}-${order.id}`}
                order={order}
                menuItems={menuItems}
                userId={claims?.sub ?? null}
                onEdit={openEdit}
                onPrint={
                  order.source === "bill"
                    ? () => void handlePrint(order.bill)
                    : () => void handlePrintKitchen(order.ticket)
                }
                onPrintBill={
                  order.source === "kitchen"
                    ? () => void handlePrintKitchenBill(order.ticket)
                    : undefined
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function OrderHistoryCard({
  order,
  menuItems,
  userId,
  onEdit,
  onPrint,
  onPrintBill,
}: {
  order: UnifiedOrder;
  menuItems: MenuItem[];
  userId: string | null;
  onEdit: (order: UnifiedOrder) => void;
  onPrint?: () => void;
  onPrintBill?: () => void;
}) {
  const styles = useScreenStyles();
  const total = unifiedOrderTotal(order, menuItems);
  const accent = orderStatusAccent(order);
  const status = unifiedOrderStatus(order);
  const meta =
    order.source === "bill"
      ? `${order.bill.billRef} · ${order.bill.waiterName}`
      : `${order.ticket.ticketRef} · ${order.ticket.createdByName ?? "Kitchen"}`;
  const editable = canEditUnifiedOrder(order, userId);
  const ownerLabel = unifiedOrderOwnerLabel(order, userId);
  const sourceLabel = order.source === "kitchen" ? "Kitchen ticket" : "Bill";
  const praInvoice =
    order.source === "bill" && order.bill.praInvoiceNumber?.trim()
      ? order.bill.praInvoiceNumber.trim()
      : null;

  return (
    <View style={[styles.orderCard, { borderLeftColor: accent }]}>
      <View style={styles.orderTop}>
        <View style={styles.orderTopCopy}>
          <Text style={styles.orderRef}>{unifiedOrderRef(order)}</Text>
          <View style={styles.orderMetaRow}>
            <View style={styles.tablePill}>
              <Text style={styles.tablePillText}>{unifiedOrderTable(order)}</Text>
            </View>
            <Text style={styles.sourceLabel}>{sourceLabel}</Text>
          </View>
        </View>
        <View style={styles.orderTopRight}>
          <Text style={styles.orderTotal}>{total != null ? formatPkr(total) : "—"}</Text>
          <StatusBadge status={status} />
        </View>
      </View>

      <Text style={styles.itemsSummary} numberOfLines={3}>
        {unifiedOrderSummary(order)}
      </Text>
      {praInvoice ? (
        <Text style={styles.praInvoiceLine} numberOfLines={2}>
          PRA Invoice # {praInvoice}
          {order.source === "bill" && order.bill.praMode === "real" ? " · Real" : ""}
          {order.source === "bill" && order.bill.praMode === "fake" ? " · FPRA" : ""}
        </Text>
      ) : null}

      <View style={styles.orderFooter}>
        <View style={styles.orderFooterLeft}>
          <Text style={styles.orderWhen}>{formatTimeAgo(order.createdAt)}</Text>
          <Text style={styles.orderWhenExact}>{formatWhen(order.createdAt)}</Text>
        </View>
        <View style={styles.orderActions}>
        {editable ? (
          <Pressable onPress={() => onEdit(order)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : ownerLabel ? (
          <Text style={styles.viewOnlyText}>By {ownerLabel} · view only</Text>
        ) : null}
        {onPrint ? (
          <Pressable onPress={onPrint} style={styles.printBtn}>
            <Text style={styles.printBtnText}>
              {order.source === "bill" ? "Print bill" : "Print order"}
            </Text>
          </Pressable>
        ) : null}
        {onPrintBill ? (
          <Pressable onPress={onPrintBill} style={styles.printBtn}>
            <Text style={styles.printBtnText}>Print bill</Text>
          </Pressable>
        ) : null}
        </View>
      </View>

      <Text style={styles.orderMeta}>{meta}</Text>
    </View>
  );
}


function useScreenStyles() {
  return useThemedStyleSheet((c) => ({

  screen: {
    paddingBottom: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 36,
  },
  topBar: {
    paddingTop: 4,
  },
  topBarCopy: {
    gap: 2,
  },
  branchName: {
    color: c.text,
    fontSize: 18,
    fontWeight: "700",
  },
  branchMeta: {
    color: c.muted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: c.muted,
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    color: c.text,
  },
  clearSearch: {
    color: c.accent,
    fontSize: 13,
    fontWeight: "600",
    paddingLeft: 8,
  },
  filterRow: {
    gap: 8,
    paddingRight: 4,
  },
  loadingWrap: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 32,
  },
  loadingText: {
    color: c.muted,
    fontSize: 14,
  },
  emptyCard: {
    paddingVertical: 8,
  },
  list: {
    gap: 10,
  },
  orderCard: {
    backgroundColor: c.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 3,
    padding: 16,
    gap: 10,
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  orderTopRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  orderTopCopy: {
    flex: 1,
    gap: 6,
  },
  orderRef: {
    color: c.text,
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "700",
  },
  orderMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  tablePill: {
    backgroundColor: c.bg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tablePillText: {
    color: c.text,
    fontSize: 12,
    fontWeight: "600",
  },
  sourceLabel: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  itemsSummary: {
    color: c.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  praInvoiceLine: {
    color: "#86efac",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  orderFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  orderFooterLeft: {
    flex: 1,
    minWidth: 0,
  },
  orderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
    maxWidth: "55%",
  },
  orderTotal: {
    color: c.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  inKitchen: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "700",
  },
  orderWhen: {
    color: c.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  orderWhenExact: {
    color: c.muted,
    fontSize: 11,
    marginTop: 2,
  },
  editBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.45)",
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  editBtnText: {
    color: c.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  viewOnlyText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "center",
  },
  printBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  printBtnText: {
    color: c.text,
    fontSize: 14,
    fontWeight: "600",
  },
  orderMeta: {
    color: c.muted,
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: -2,
  },

  }));
}

