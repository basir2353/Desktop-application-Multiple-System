import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { DELIVERY_STATUS_LABELS, type DeliveryStatus } from "@platform/contracts";
import { fetchMyDeliveries } from "../src/api/delivery";
import { EmptyState, Notice, Screen, StatusBadge, colors } from "../src/components/ui";
import { formatPkr, formatTimeAgo, orderRefFromTicket } from "../src/lib/orderDisplay";
import { isRiderRole, resolveStaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function RiderDeliveriesScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";
  const role = resolveStaffRole(claims);

  const deliveriesQuery = useQuery({
    queryKey: ["my-deliveries", branchCode],
    enabled: Boolean(branchCode) && isRiderRole(claims),
    queryFn: () => fetchMyDeliveries(branchCode),
    refetchInterval: 8_000,
  });

  if (!accessToken) return <Redirect href="/" />;
  if (role === "waiter") return <Redirect href="/home" />;
  if (!branch) return <Redirect href="/branch" />;

  const orders = deliveriesQuery.data ?? [];

  return (
    <Screen>
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
        {deliveriesQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : deliveriesQuery.isError ? (
          <Notice>{(deliveriesQuery.error as Error).message}</Notice>
        ) : orders.length === 0 ? (
          <EmptyState
            title="No deliveries assigned"
            message="When the restaurant assigns delivery orders to you, they will show up here."
          />
        ) : (
          orders.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => router.push({ pathname: "/rider-delivery", params: { id: order.id } })}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.header}>
                <Text style={styles.ref}>{orderRefFromTicket(order)}</Text>
                <StatusBadge
                  status={
                    order.deliveryStatus
                      ? DELIVERY_STATUS_LABELS[order.deliveryStatus as DeliveryStatus]
                      : order.status === "done"
                        ? "Completed"
                        : "In kitchen"
                  }
                />
              </View>
              <Text style={styles.customer}>{order.customerName}</Text>
              <Text style={styles.address}>{order.customerAddress}</Text>
              <Text style={styles.items} numberOfLines={2}>
                {order.itemsSummary.split(" · Delivery")[0]}
              </Text>
              <Text style={styles.meta}>
                {formatTimeAgo(order.createdAt)} · {formatPkr(order.deliveryChargePkr)} delivery fee
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { color: colors.text, fontWeight: "700", fontSize: 15 },
  customer: { color: colors.text, fontSize: 16, fontWeight: "600" },
  address: { color: colors.muted, fontSize: 13 },
  items: { color: colors.muted, fontSize: 12, marginTop: 2 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
});
