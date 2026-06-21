import { type KitchenTicket } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { fetchKitchenTickets } from "../src/api/kitchen";
import {
  Card,
  EmptyState,
  Label,
  Muted,
  Screen,
  StatusBadge,
  Subtitle,
  colors,
} from "../src/components/ui";
import { canEditKitchenTicket } from "../src/lib/loadOrder";
import {
  formatTimeAgo,
  kitchenStatusLabel,
  orderRefFromTicket,
} from "../src/lib/orderDisplay";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function OrdersScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: 5_000,
  });

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  const tickets = [...(kitchenQuery.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const active = tickets.filter((t) => t.status !== "done");
  const ready = active.filter((t) => t.status === "ready");

  function openEdit(ticket: KitchenTicket): void {
    router.push({ pathname: "/order", params: { editTicketId: ticket.id } });
  }

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={kitchenQuery.isFetching}
            onRefresh={() => void kitchenQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Subtitle>
          {active.length} active order{active.length === 1 ? "" : "s"}
          {ready.length > 0 ? ` · ${ready.length} ready` : ""}
        </Subtitle>

        {kitchenQuery.isLoading ? (
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
          active.map((ticket) => (
            <Card key={ticket.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 15, fontWeight: "700" }}>
                  {orderRefFromTicket(ticket)}
                </Text>
                <StatusBadge status={kitchenStatusLabel(ticket.status)} />
              </View>
              <Label>{ticket.stationLabel}</Label>
              <Muted>{ticket.itemsSummary}</Muted>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Muted>{formatTimeAgo(ticket.createdAt)}</Muted>
                <Muted>{ticket.mins} min · {ticket.ticketRef}</Muted>
              </View>
              {ticket.priority === "priority" ? (
                <Text style={{ color: colors.warning, fontSize: 13 }}>Priority order</Text>
              ) : null}
              {canEditKitchenTicket(ticket) ? (
                <Pressable
                  onPress={() => openEdit(ticket)}
                  style={{
                    marginTop: 8,
                    alignSelf: "flex-start",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "rgba(245, 158, 11, 0.45)",
                    backgroundColor: "rgba(245, 158, 11, 0.12)",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>Edit order</Text>
                </Pressable>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
