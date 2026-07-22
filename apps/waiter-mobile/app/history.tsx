import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Bill, BillPayment, KitchenTicket, MenuItem } from "@platform/contracts";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { completeBill, fetchOrders } from "../src/api/billing";
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
import { CloseOrderModal } from "../src/components/CloseOrderModal";
import { formatPkr, formatTimeAgo, formatWhen, isToday } from "../src/lib/orderDisplay";
import { printBillReceipt, printCartBill, printKitchenOrder } from "../src/lib/printBill";
import { canCloseOrders, isWaiterRole } from "../src/lib/roles";
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
import { useBranchStore } from "../src/stores/branchStore";
import { resolveStaffRole } from "../src/lib/roles";
import { useSessionStore } from "../src/stores/sessionStore";

const SERVICE_PCT = 10;
const TAX_PCT = 15;

type HistoryFilter = "today" | "all" | "held";

export default function HistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";
  const [filter, setFilter] = useState<HistoryFilter>(
    params.filter === "held" ? "held" : "today",
  );
  const [search, setSearch] = useState("");
  const [closeBill, setCloseBill] = useState<Bill | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cashierCanClose = canCloseOrders(claims) && !isWaiterRole(claims);

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

  const closeMutation = useMutation({
    mutationFn: (payload: { billId: string; payments: BillPayment[] }) =>
      completeBill(payload.billId, {
        payments: payload.payments,
        servicePct: SERVICE_PCT,
        taxPct: TAX_PCT,
      }),
    onSuccess: async (bill) => {
      setCloseBill(null);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      let message = `Order ${bill.billRef} closed successfully.`;
      if (branch) {
        const printed = await printBillReceipt(branch.name, branch.code, bill);
        if (printed) message = `${message} Receipt printed.`;
      }
      setNotice(message);
    },
    onError: (err: Error) => setNotice(err.message),
  });

  async function handlePrint(bill: Bill): Promise<void> {
    if (!branch) return;
    const ok = await printBillReceipt(branch.name, branch.code, bill);
    setNotice(ok ? `Bill for ${bill.billRef} sent to printer.` : `Could not print ${bill.billRef}.`);
  }

  async function handlePrintKitchen(ticket: KitchenTicket): Promise<void> {
    if (!branch) return;
    const ok = await printKitchenOrder(branch.name, branch.code, ticket, menuItems);
    setNotice(
      ok
        ? `Print order sent for ${ticket.orderRef ?? ticket.ticketRef}.`
        : `Could not print ${ticket.orderRef ?? ticket.ticketRef}.`,
    );
  }

  async function handlePrintKitchenBill(ticket: KitchenTicket): Promise<void> {
    if (!branch) return;
    const lines = (ticket.lines ?? []).map((line) => ({
      label: line.label,
      qty: line.qty,
      unitPrice: line.unitPrice ?? 0,
    }));
    const subtotal =
      lines.length > 0
        ? lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)
        : kitchenTicketTotal(ticket, menuItems) ?? 0;
    const service = Math.round(subtotal * (SERVICE_PCT / 100));
    const tax = Math.round((subtotal + service) * (TAX_PCT / 100));
    const total = subtotal + service + tax;
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
      service,
      servicePct: SERVICE_PCT,
      tax,
      taxPct: TAX_PCT,
      total,
    });
    setNotice(
      ok
        ? `Bill sent for ${ticket.orderRef ?? ticket.ticketRef}.`
        : `Could not print bill for ${ticket.orderRef ?? ticket.ticketRef}.`,
    );
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
          <Notice tone={notice.includes("success") || notice.includes("closed") || notice.includes("printed") ? "success" : "warning"}>
            {notice}
          </Notice>
        ) : null}

        <View style={styles.statsRow}>
          <StatCard label="Showing" value={filtered.length} hint={`${kitchenCount} kitchen · ${billCount} bills`} />
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
                onClose={cashierCanClose && order.source === "bill" && order.bill.status === "held" ? () => setCloseBill(order.bill) : undefined}
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

      {closeBill ? (
        <CloseOrderModal
          bill={closeBill}
          visible
          loading={closeMutation.isPending}
          onClose={() => setCloseBill(null)}
          onConfirm={(payments) =>
            closeMutation.mutate({ billId: closeBill.id, payments })
          }
        />
      ) : null}
    </Screen>
  );
}

function OrderHistoryCard({
  order,
  menuItems,
  userId,
  onEdit,
  onClose,
  onPrint,
  onPrintBill,
}: {
  order: UnifiedOrder;
  menuItems: MenuItem[];
  userId: string | null;
  onEdit: (order: UnifiedOrder) => void;
  onClose?: () => void;
  onPrint?: () => void;
  onPrintBill?: () => void;
}) {
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
        {onClose ? (
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        ) : null}
        </View>
      </View>

      <Text style={styles.orderMeta}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  branchMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: "#64748b",
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    color: "#0f172a",
  },
  clearSearch: {
    color: colors.accent,
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
    color: colors.muted,
    fontSize: 14,
  },
  emptyCard: {
    paddingVertical: 8,
  },
  list: {
    gap: 10,
  },
  orderCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
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
    backgroundColor: "#0b1220",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tablePillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  sourceLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  itemsSummary: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  inKitchen: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "700",
  },
  orderWhen: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  orderWhenExact: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  editBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  editBtnText: {
    color: colors.accent,
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
    borderColor: colors.border,
    backgroundColor: "#0b1220",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  printBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  closeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.45)",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  closeBtnText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
  orderMeta: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: -2,
  },
});
