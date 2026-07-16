import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { DELIVERY_STATUS_LABELS, type DeliveryStatus } from "@platform/contracts";
import { fetchMyDeliveries, updateDeliveryStatus } from "../src/api/delivery";
import { Button, Card, Notice, Screen, StatusBadge, colors } from "../src/components/ui";
import { formatPkr, formatTimeAgo, orderRefFromTicket } from "../src/lib/orderDisplay";
import { deliveryOrderTotal } from "../src/lib/orderHistory";
import { isRiderRole, resolveStaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function RiderDeliveryDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const order = deliveriesQuery.data?.find((o) => o.id === id);

  const statusMutation = useMutation({
    mutationFn: (deliveryStatus: "out_for_delivery" | "delivered") =>
      updateDeliveryStatus(id!, { deliveryStatus }),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["my-deliveries", branchCode] });
      if (variables === "delivered") {
        router.replace("/rider-home");
      }
    },
  });

  if (!accessToken) return <Redirect href="/" />;
  if (role === "waiter") return <Redirect href="/home" />;
  if (!branch) return <Redirect href="/branch" />;

  if (deliveriesQuery.isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen>
        <Notice>Delivery not found or no longer assigned to you.</Notice>
        <Button label="Back to dashboard" onPress={() => router.replace("/rider-home")} />
      </Screen>
    );
  }

  const status = order.deliveryStatus;
  const canStart = status === "assigned";
  const canComplete = status === "out_for_delivery";
  const isDone = status === "delivered" || order.status === "done";
  const total = deliveryOrderTotal(order);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.ref}>{orderRefFromTicket(order)}</Text>
          <StatusBadge
            status={status ? DELIVERY_STATUS_LABELS[status as DeliveryStatus] : "Pending"}
          />
        </View>

        <Card style={styles.section}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.value}>{order.customerName}</Text>
          <Text style={[styles.label, { marginTop: 12 }]}>Delivery address</Text>
          <Text style={styles.value}>{order.customerAddress}</Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.label}>Order items</Text>
          <Text style={styles.items}>{order.itemsSummary.split(" · Delivery")[0]}</Text>
          {order.notes ? (
            <>
              <Text style={[styles.label, { marginTop: 12 }]}>Notes</Text>
              <Text style={styles.value}>{order.notes}</Text>
            </>
          ) : null}
        </Card>

        <Card style={styles.section}>
          {total != null ? (
            <>
              <Text style={styles.label}>Total bill</Text>
              <Text style={[styles.value, styles.total]}>{formatPkr(total)}</Text>
            </>
          ) : null}
          <Text style={[styles.label, total != null && { marginTop: 12 }]}>Delivery fee</Text>
          <Text style={styles.value}>{formatPkr(order.deliveryChargePkr)}</Text>
          <Text style={styles.meta}>Placed {formatTimeAgo(order.createdAt)}</Text>
        </Card>

        {statusMutation.isError ? (
          <Notice>{(statusMutation.error as Error).message}</Notice>
        ) : null}

        {!isDone ? (
          <View style={styles.actions}>
            {canStart ? (
              <Button
                label="Start delivery"
                loading={statusMutation.isPending}
                onPress={() => statusMutation.mutate("out_for_delivery")}
              />
            ) : null}
            {canComplete ? (
              <Button
                label="Mark delivered"
                loading={statusMutation.isPending}
                onPress={() => statusMutation.mutate("delivered")}
              />
            ) : null}
            {!canStart && !canComplete ? (
              <Notice tone="success">
                Waiting for restaurant to mark this order ready for pickup.
              </Notice>
            ) : null}
          </View>
        ) : (
          <Notice tone="success">This delivery has been completed.</Notice>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { color: colors.text, fontSize: 20, fontWeight: "700" },
  section: { gap: 4 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  value: { color: colors.text, fontSize: 16, lineHeight: 22 },
  total: { color: colors.accent, fontSize: 22, fontWeight: "700" },
  items: { color: colors.text, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 8 },
  actions: { gap: 10, marginTop: 8 },
});
