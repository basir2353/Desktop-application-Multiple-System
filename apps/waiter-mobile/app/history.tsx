import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
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
import { fetchOrders } from "../src/api/billing";
import { fetchKitchenTickets } from "../src/api/kitchen";
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
import { formatPkr, formatTimeAgo, formatWhen, isToday } from "../src/lib/orderDisplay";
import {
  buildUnifiedOrders,
  canEditUnifiedOrder,
  matchesOrderSearch,
  orderStatusAccent,
  unifiedOrderRef,
  unifiedOrderStatus,
  unifiedOrderSummary,
  unifiedOrderTable,
  unifiedOrderTotal,
  type UnifiedOrder,
} from "../src/lib/orderHistory";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type HistoryFilter = "today" | "all" | "held";

export default function HistoryScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";
  const [filter, setFilter] = useState<HistoryFilter>("today");
  const [search, setSearch] = useState("");

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
  const totalAmount = filtered.reduce((sum, order) => sum + (unifiedOrderTotal(order) ?? 0), 0);
  const loading = ordersQuery.isLoading || kitchenQuery.isLoading;
  const refreshing = ordersQuery.isFetching || kitchenQuery.isFetching;
  const queryError =
    (ordersQuery.error as Error | null)?.message ??
    (kitchenQuery.error as Error | null)?.message ??
    null;

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  function refreshAll(): void {
    void ordersQuery.refetch();
    void kitchenQuery.refetch();
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

        <View style={styles.statsRow}>
          <StatCard label="Showing" value={filtered.length} hint={`${kitchenCount} kitchen · ${billCount} bills`} />
          <StatCard
            label={filter === "held" ? "Held value" : "Sales"}
            value={formatPkr(totalAmount)}
            accent={colors.accent}
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
                      : "Your branch order history will appear here."
              }
            />
          </Card>
        ) : (
          <View style={styles.list}>
            {filtered.map((order) => (
              <OrderHistoryCard key={`${order.source}-${order.id}`} order={order} onEdit={openEdit} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function OrderHistoryCard({
  order,
  onEdit,
}: {
  order: UnifiedOrder;
  onEdit: (order: UnifiedOrder) => void;
}) {
  const total = unifiedOrderTotal(order);
  const accent = orderStatusAccent(order);
  const status = unifiedOrderStatus(order);
  const meta =
    order.source === "bill"
      ? `${order.bill.billRef} · ${order.bill.waiterName}`
      : `${order.ticket.ticketRef} · Kitchen`;
  const editable = canEditUnifiedOrder(order);
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
        <StatusBadge status={status} />
      </View>

      <Text style={styles.itemsSummary} numberOfLines={3}>
        {unifiedOrderSummary(order)}
      </Text>

      <View style={styles.orderFooter}>
        <View>
          {total != null ? (
            <Text style={styles.orderTotal}>{formatPkr(total)}</Text>
          ) : (
            <Text style={styles.inKitchen}>In kitchen</Text>
          )}
          <Text style={styles.orderWhen}>{formatTimeAgo(order.createdAt)}</Text>
          <Text style={styles.orderWhenExact}>{formatWhen(order.createdAt)}</Text>
        </View>
        {editable ? (
          <Pressable onPress={() => onEdit(order)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : null}
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
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: colors.muted,
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
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
  orderMeta: {
    color: colors.muted,
    fontSize: 11,
    fontFamily: "monospace",
    marginTop: -2,
  },
});
