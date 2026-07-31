import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { fetchOrders } from "../src/api/billing";
import { AdminShell } from "../src/components/AdminBottomNav";
import { DateRangeFilter, defaultDateRange, type DateRangeValue } from "../src/components/DateRangeFilter";
import { Card, Notice, Screen, StatCard, Subtitle, colors } from "../src/components/ui";
import {
  channelSalesFromOrders,
  filterOrdersByDateRange,
  formatPkr,
  karachiDateKey,
  karachiTime,
  salesMetricsFromOrders,
  topProductsFromOrders,
  billChannelLabel,
} from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminSalesScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const [range, setRange] = useState<DateRangeValue>(defaultDateRange);
  const branchCode = branch?.code;

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", branchCode],
    queryFn: () => fetchOrders(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 30_000,
  });

  const filtered = useMemo(
    () => filterOrdersByDateRange(ordersQuery.data ?? [], range.from, range.to),
    [ordersQuery.data, range.from, range.to],
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
      <AdminShell tab="more" noPadding>
        <Screen>
          <Notice>Select a branch on the Admin Dashboard first.</Notice>
        </Screen>
      </AdminShell>
    );
  }

  return (
    <AdminShell tab="more" noPadding>
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 40 }}>
        <Subtitle>
          {branch?.name ?? branchCode} · {branchCode}
          {"\n"}
          Business day · Asia/Karachi
        </Subtitle>

        <Card>
          <DateRangeFilter value={range} onChange={setRange} />
        </Card>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Sales in range"
            value={ordersQuery.isLoading ? "…" : formatPkr(metrics.allCompletedAmountPkr)}
            hint={`${metrics.orderCount} orders`}
            accent={colors.success}
          />
          <StatCard
            label="Avg ticket"
            value={
              metrics.orderCount
                ? formatPkr(Math.round(metrics.allCompletedAmountPkr / metrics.orderCount))
                : "—"
            }
          />
        </View>

        {channels.length > 0 ? (
          <Card>
            <Subtitle>By channel</Subtitle>
            {channels.map((c) => (
              <View
                key={c.label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text }}>
                  {c.label} · {c.count}
                </Text>
                <Text style={{ color: colors.success, fontWeight: "700" }}>{formatPkr(c.amount)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {topItems.length > 0 ? (
          <Card>
            <Subtitle>Top items</Subtitle>
            {topItems.map((item) => (
              <View
                key={item.label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>{item.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Qty {item.qty}</Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{formatPkr(item.revenue)}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <Subtitle>Sales list</Subtitle>
          {sortedSales.length === 0 ? (
            <Text style={{ color: colors.muted }}>No sales in this date range.</Text>
          ) : (
            sortedSales.slice(0, 80).map((order) => (
              <View
                key={order.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {order.orderRef ?? order.billRef}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {karachiDateKey(order.createdAt)} {karachiTime(order.createdAt)} ·{" "}
                    {billChannelLabel(order.tableLabel)}
                  </Text>
                </View>
                <Text style={{ color: colors.success, fontWeight: "800" }}>{formatPkr(order.total)}</Text>
              </View>
            ))
          )}
        </Card>

        {ordersQuery.isError ? <Notice>{(ordersQuery.error as Error).message}</Notice> : null}
      </ScrollView>
    </Screen>
    </AdminShell>
  );
}
