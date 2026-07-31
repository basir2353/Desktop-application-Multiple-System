import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchOrders } from "../src/api/billing";
import { fetchKitchenTickets, updateKitchenTicket } from "../src/api/kitchen";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Card,
  Chip,
  EmptyState,
  Notice,
  StatusBadge,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import {
  formatPkr,
  formatTimeAgo,
  kitchenStatusLabel,
  orderRefFromBill,
  orderRefFromTicket,
} from "../src/lib/orderDisplay";
import { billChannelLabel } from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type Filter = "all" | "open" | "kitchen" | "completed";

export default function AdminOrdersScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", branchCode],
    queryFn: () => fetchOrders(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 8_000,
  });

  const kitchenQuery = useQuery({
    queryKey: ["admin", "kitchen", branchCode],
    queryFn: () => fetchKitchenTickets(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 5_000,
  });

  const advance = useMutation({
    mutationFn: (input: { id: string; status: "cooking" | "ready" | "done" }) =>
      updateKitchenTicket(input.id, { status: input.status }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "kitchen", branchCode] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const bills = useMemo(() => {
    const list = [...(ordersQuery.data ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (filter === "open") return list.filter((b) => b.status === "open" || b.status === "held");
    if (filter === "completed") return list.filter((b) => b.status === "completed");
    return list;
  }, [ordersQuery.data, filter]);

  const kitchen = useMemo(() => {
    return [...(kitchenQuery.data ?? [])]
      .filter((t) => t.status !== "done")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [kitchenQuery.data]);

  if (!allowed) return <Redirect href="/" />;

  const openCount = (ordersQuery.data ?? []).filter(
    (b) => b.status === "open" || b.status === "held",
  ).length;
  const kitchenCount = kitchen.length;
  const completedToday = (ordersQuery.data ?? []).filter((b) => {
    if (b.status !== "completed") return false;
    return new Date(b.createdAt).toDateString() === new Date().toDateString();
  }).length;

  return (
    <AdminShell tab="orders" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={ordersQuery.isFetching || kitchenQuery.isFetching}
            onRefresh={() => {
              void ordersQuery.refetch();
              void kitchenQuery.refetch();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Title>Orders</Title>
            <Subtitle>{branchCode ? `Live · ${branchCode}` : "Select a branch on Home"}</Subtitle>
          </View>
          <Pressable
            onPress={() => router.push("/admin-kitchen")}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              borderWidth: 1,
              borderColor: "rgba(245, 158, 11, 0.4)",
            }}
          >
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>Kitchen</Text>
          </Pressable>
        </View>

        {!branchCode ? <Notice>Pick a branch on Home first.</Notice> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Open bills" value={openCount} hint="Held / open" />
          <StatCard
            label="Kitchen"
            value={kitchenCount}
            hint="Active tickets"
            accent={kitchenCount > 8 ? colors.danger : undefined}
          />
          <StatCard label="Done today" value={completedToday} hint="Completed" accent={colors.success} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(
            [
              ["all", "All bills"],
              ["open", "Open"],
              ["kitchen", "Kitchen"],
              ["completed", "Completed"],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} label={label} selected={filter === id} onPress={() => setFilter(id)} />
          ))}
        </ScrollView>

        {error ? <Notice>{error}</Notice> : null}

        {filter === "kitchen" || filter === "all" ? (
          <Card>
            <Subtitle>Kitchen queue · {kitchen.length}</Subtitle>
            {kitchenQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : kitchen.length === 0 ? (
              <EmptyState title="Kitchen clear" message="No active tickets right now." />
            ) : (
              kitchen.slice(0, filter === "kitchen" ? 40 : 6).map((ticket) => {
                const next =
                  ticket.status === "new"
                    ? "cooking"
                    : ticket.status === "cooking"
                      ? "ready"
                      : ticket.status === "ready"
                        ? "done"
                        : null;
                const lineCount = ticket.lines?.length ?? 0;
                return (
                  <View
                    key={ticket.id}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {orderRefFromTicket(ticket)}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {formatTimeAgo(ticket.createdAt)} ·{" "}
                          {lineCount > 0 ? `${lineCount} lines` : ticket.itemsSummary} ·{" "}
                          {ticket.stationLabel}
                        </Text>
                      </View>
                      <StatusBadge status={kitchenStatusLabel(ticket.status)} />
                    </View>
                    {next ? (
                      <Pressable
                        disabled={advance.isPending}
                        onPress={() => advance.mutate({ id: ticket.id, status: next })}
                        style={{
                          alignSelf: "flex-start",
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ color: colors.accentText, fontWeight: "700", fontSize: 12 }}>
                          Mark {next}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </Card>
        ) : null}

        {filter !== "kitchen" ? (
          <Card>
            <Subtitle>Bills · {bills.length}</Subtitle>
            {ordersQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : bills.length === 0 ? (
              <EmptyState title="No bills" message="Nothing matches this filter." />
            ) : (
              bills.slice(0, 40).map((bill) => (
                <View
                  key={bill.id}
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
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {orderRefFromBill(bill)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {formatTimeAgo(bill.createdAt)} · {billChannelLabel(bill.tableLabel)} ·{" "}
                      {bill.status}
                    </Text>
                  </View>
                  <Text style={{ color: colors.success, fontWeight: "800" }}>
                    {formatPkr(bill.total)}
                  </Text>
                </View>
              ))
            )}
          </Card>
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}
