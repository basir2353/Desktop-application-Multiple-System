import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DELIVERY_STATUS_LABELS, type DeliveryOrder, type DeliveryStatus } from "@platform/contracts";
import { fetchMyDeliveries } from "../src/api/delivery";
import { fetchBranchMenu } from "../src/api/menu";
import {
  Button,
  Card,
  EmptyState,
  Notice,
  Screen,
  SectionHeader,
  StatCard,
  StatusBadge,
  colors,
} from "../src/components/ui";
import { formatPkr, formatTimeAgo, orderRefFromTicket } from "../src/lib/orderDisplay";
import { deliveryOrderTotal } from "../src/lib/orderHistory";
import { isRiderRole, resolveStaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

function activeDeliveries(orders: DeliveryOrder[]): DeliveryOrder[] {
  return orders.filter((o) => o.status !== "done" && o.deliveryStatus !== "delivered");
}

export default function RiderHomeScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);

  const branchCode = branch?.code ?? "";
  const role = resolveStaffRole(claims);

  const deliveriesQuery = useQuery({
    queryKey: ["my-deliveries", branchCode],
    enabled: Boolean(branchCode) && isRiderRole(claims),
    queryFn: () => fetchMyDeliveries(branchCode),
    refetchInterval: 8_000,
  });

  const menuQuery = useQuery({
    queryKey: ["menu", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchMenu(branchCode),
    staleTime: 5 * 60_000,
  });

  const orders = deliveriesQuery.data ?? [];
  const active = useMemo(() => activeDeliveries(orders), [orders]);
  const menuItems = menuQuery.data?.items ?? [];

  const assigned = active.filter((o) => o.deliveryStatus === "assigned").length;
  const enRoute = active.filter((o) => o.deliveryStatus === "out_for_delivery").length;
  const completedToday = orders.filter(
    (o) => o.deliveryStatus === "delivered" || o.status === "done",
  ).length;

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (role === "waiter") {
    return <Redirect href="/home" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  if (!claims?.riderId) {
    return (
      <Screen safeTop>
        <Card>
          <Text style={styles.title}>Delivery profile missing</Text>
          <Text style={styles.subtitle}>
            Your account is a delivery rider, but no rider profile is linked. Ask an administrator to
            link your login in the desktop Delivery module.
          </Text>
          <Button
            label="Sign out"
            onPress={() => {
              clearSession();
              clearBranch();
              router.replace("/");
            }}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen safeTop>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={deliveriesQuery.isFetching && !deliveriesQuery.isLoading}
            onRefresh={() => void deliveriesQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Delivery dashboard</Text>
            <Text style={styles.subtitle}>
              {waiterEmail?.split("@")[0] ?? "Rider"} · {branch.name}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              clearBranch();
              router.replace("/branch");
            }}
          >
            <Text style={styles.link}>Switch branch</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Assigned" value={String(assigned)} accent={colors.accent} />
          <StatCard label="En route" value={String(enRoute)} accent="#f59e0b" />
          <StatCard label="Completed" value={String(completedToday)} accent={colors.success} />
        </View>

        <SectionHeader
          title="Active deliveries"
          actionLabel="View all"
          onAction={() => router.push("/rider-deliveries")}
        />

        {deliveriesQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : deliveriesQuery.isError ? (
          <Notice>{(deliveriesQuery.error as Error).message}</Notice>
        ) : active.length === 0 ? (
          <EmptyState
            title="No active deliveries"
            message={`Nothing assigned to you at ${branch.name} yet. On the desktop app, open Delivery → Orders (branch ${branch.code}), assign delivery orders to your rider name, then pull down to refresh.`}
          />
        ) : (
          active.slice(0, 5).map((order) => {
            const total = deliveryOrderTotal(order, menuItems);
            return (
              <Pressable
                key={order.id}
                onPress={() => router.push({ pathname: "/rider-delivery", params: { id: order.id } })}
                style={({ pressed }) => [styles.orderCard, pressed && styles.orderCardPressed]}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderRef}>{orderRefFromTicket(order)}</Text>
                  <View style={styles.orderHeaderRight}>
                    <Text style={styles.orderTotal}>
                      {total != null ? formatPkr(total) : "—"}
                    </Text>
                    <StatusBadge
                      status={
                        order.deliveryStatus
                          ? DELIVERY_STATUS_LABELS[order.deliveryStatus as DeliveryStatus]
                          : "Pending"
                      }
                    />
                  </View>
                </View>
                <Text style={styles.customer}>{order.customerName}</Text>
                <Text style={styles.address} numberOfLines={2}>
                  {order.customerAddress}
                </Text>
                <Text style={styles.meta}>
                  {formatTimeAgo(order.createdAt)} · {formatPkr(order.deliveryChargePkr)} delivery
                </Text>
              </Pressable>
            );
          })
        )}

        <View style={styles.footer}>
          <Button label="All deliveries" onPress={() => router.push("/rider-deliveries")} />
          <Button label="Manage PIN" variant="ghost" onPress={() => router.push("/manage-pin")} />
          <Pressable
            onPress={() => {
              clearSession();
              clearBranch();
              router.replace("/");
            }}
          >
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 32 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  greeting: { color: colors.text, fontSize: 24, fontWeight: "700" },
  title: { color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  link: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 10 },
  orderCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  orderCardPressed: { opacity: 0.85 },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderHeaderRight: { alignItems: "flex-end", gap: 6 },
  orderRef: { color: colors.text, fontSize: 15, fontWeight: "700" },
  customer: { color: colors.text, fontSize: 16, fontWeight: "600" },
  address: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  orderTotal: { color: colors.accent, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  footer: { gap: 16, marginTop: 8 },
  signOut: { color: colors.muted, textAlign: "center", fontSize: 13 },
});
