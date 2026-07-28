import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fetchOrders } from "../src/api/billing";
import { Card, Notice, Screen, StatCard, Subtitle, colors } from "../src/components/ui";
import {
  channelSalesFromOrders,
  currentBusinessDateKey,
  filterOrdersByDate,
  formatPkr,
  karachiDateKey,
  karachiTime,
  payableCompletedOrders,
  salesMetricsFromOrders,
  topProductsFromOrders,
  billChannelLabel,
} from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type Range = "today" | "all";

export default function AdminSalesScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const [range, setRange] = useState<Range>("today");
  const branchCode = branch?.code;
  const todayKey = currentBusinessDateKey();

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", branchCode],
    queryFn: () => fetchOrders(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 30_000,
  });

  const allCompleted = useMemo(
    () => payableCompletedOrders(ordersQuery.data ?? []),
    [ordersQuery.data],
  );
  const filtered = useMemo(
    () => (range === "today" ? filterOrdersByDate(ordersQuery.data ?? [], todayKey) : allCompleted),
    [range, ordersQuery.data, todayKey, allCompleted],
  );
  const metrics = useMemo(() => salesMetricsFromOrders(filtered), [filtered]);
  const channels = useMemo(() => channelSalesFromOrders(filtered), [filtered]);
  const topItems = useMemo(() => topProductsFromOrders(filtered, 15), [filtered]);
  const sortedSales = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [filtered],
  );

  if (!allowed) {
    return <Redirect href="/" />;
  }

  if (!branchCode) {
    return (
      <Screen>
        <Notice>Select a branch on the Admin Dashboard first.</Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 40 }}>
        <Subtitle>
          {branch?.name ?? branchCode} · {branchCode}
          {"\n"}
          Business day · Asia/Karachi
        </Subtitle>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {(
            [
              { id: "today" as const, label: "Today" },
              { id: "all" as const, label: "All sales" },
            ] as const
          ).map((tab) => {
            const active = range === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setRange(tab.id)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.accent : colors.card,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: active ? colors.accentText : colors.text,
                    fontWeight: "800",
                    fontSize: 13,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label={range === "today" ? "Sales today" : "Total sales"}
            value={ordersQuery.isLoading ? "…" : formatPkr(metrics.allCompletedAmountPkr)}
            hint={`${metrics.orderCount} orders`}
            accent={colors.success}
          />
          <StatCard
            label="Avg ticket"
            value={
              ordersQuery.isLoading
                ? "…"
                : metrics.orderCount > 0
                  ? formatPkr(metrics.allCompletedAmountPkr / metrics.orderCount)
                  : formatPkr(0)
            }
            hint={range === "today" ? todayKey : "All completed"}
          />
        </View>

        {channels.length > 0 ? (
          <Card>
            <Subtitle>By channel</Subtitle>
            {channels.map((ch) => (
              <View
                key={ch.label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{ch.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{ch.count} orders</Text>
                </View>
                <Text style={{ color: colors.success, fontWeight: "800" }}>{formatPkr(ch.amount)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {topItems.length > 0 ? (
          <Card>
            <Subtitle>Top items sold</Subtitle>
            {topItems.map((item, idx) => (
              <View
                key={item.label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "700", width: 22 }}>{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Qty {item.qty}</Text>
                </View>
                <Text style={{ color: colors.success, fontWeight: "800" }}>{formatPkr(item.revenue)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <Subtitle>Sales list ({sortedSales.length})</Subtitle>
          {ordersQuery.isLoading ? (
            <Text style={{ color: colors.muted }}>Loading sales…</Text>
          ) : sortedSales.length === 0 ? (
            <Text style={{ color: colors.muted }}>No completed sales in this range.</Text>
          ) : (
            sortedSales.map((order) => (
              <View
                key={order.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {order.orderRef ?? order.billRef}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {karachiDateKey(order.createdAt)} {karachiTime(order.createdAt)} ·{" "}
                    {billChannelLabel(order.tableLabel)}
                    {order.tableLabel ? ` · ${order.tableLabel}` : ""}
                  </Text>
                  {order.waiterName ? (
                    <Text style={{ color: colors.muted, fontSize: 11 }}>Waiter: {order.waiterName}</Text>
                  ) : null}
                </View>
                <Text style={{ color: colors.success, fontWeight: "800", fontSize: 13 }}>
                  {formatPkr(order.total)}
                </Text>
              </View>
            ))
          )}
        </Card>

        {ordersQuery.isError ? (
          <Notice>{(ordersQuery.error as Error).message || "Could not load sales"}</Notice>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
