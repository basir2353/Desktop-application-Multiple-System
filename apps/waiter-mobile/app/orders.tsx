import { type KitchenTicket } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { fetchKitchenTickets } from "../src/api/kitchen";
import { fetchBranchMenu } from "../src/api/menu";
import {
  Card,
  EmptyState,
  Label,
  Muted,
  Notice,
  Screen,
  StatusBadge,
  Subtitle,
  colors,
} from "../src/components/ui";
import { canEditKitchenTicket, canTransferKitchenTicket, ownsKitchenTicket } from "../src/lib/loadOrder";
import {
  formatTimeAgo,
  formatPkr,
  kitchenStatusLabel,
  orderRefFromTicket,
} from "../src/lib/orderDisplay";
import { kitchenTicketTotal } from "../src/lib/orderHistory";
import { printKitchenOrder } from "../src/lib/printBill";
import { inferOrderModeFromStation } from "../src/lib/orderMode";
import { resolveStaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function OrdersScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";
  const [notice, setNotice] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: 5_000,
  });

  const menuQuery = useQuery({
    queryKey: ["menu", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchMenu(branchCode),
    staleTime: 5 * 60_000,
  });

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (resolveStaffRole(claims) === "rider") {
    return <Redirect href="/rider-home" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  const tickets = [...(kitchenQuery.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const active = tickets.filter((t) => t.status !== "done");
  const ready = active.filter((t) => t.status === "ready");
  const menuItems = menuQuery.data?.items ?? [];

  function openEdit(ticket: KitchenTicket): void {
    router.push({ pathname: "/order", params: { editTicketId: ticket.id } });
  }

  function openTransfer(ticket: KitchenTicket): void {
    router.push({ pathname: "/table-transfer", params: { ticketId: ticket.id } });
  }

  async function handlePrint(ticket: KitchenTicket): Promise<void> {
    if (!branch) return;
    setPrintingId(ticket.id);
    setNotice(null);
    const ok = await printKitchenOrder(branch.name, branch.code, ticket, menuItems);
    setPrintingId(null);
    setNotice(
      ok
        ? `Print order sent for ${orderRefFromTicket(ticket)}.`
        : `Could not print ${orderRefFromTicket(ticket)}.`,
    );
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Subtitle>
            {active.length} active order{active.length === 1 ? "" : "s"}
            {ready.length > 0 ? ` · ${ready.length} ready` : ""}
          </Subtitle>
          <Pressable onPress={() => router.push("/table-transfer")}>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>Transfer</Text>
          </Pressable>
        </View>

        {notice ? (
          <Notice tone={notice.includes("sent") ? "success" : "warning"}>{notice}</Notice>
        ) : null}

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
          active.map((ticket) => {
            const canEdit = canEditKitchenTicket(ticket) && ownsKitchenTicket(ticket, claims?.sub);
            const canTransfer = canTransferKitchenTicket(ticket, claims?.sub);
            const isDineIn = inferOrderModeFromStation(ticket.stationLabel) === "dine-in";
            const isPrinting = printingId === ticket.id;
            return (
              <Card key={ticket.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 15, fontWeight: "700" }}>
                    {orderRefFromTicket(ticket)}
                  </Text>
                  <StatusBadge status={kitchenStatusLabel(ticket.status)} />
                </View>
                <Label>
                  {ticket.stationLabel}
                  {ticket.createdByName ? ` · by ${ticket.createdByName}` : ""}
                </Label>
                <Muted>{ticket.itemsSummary}</Muted>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  <Muted>{formatTimeAgo(ticket.createdAt)}</Muted>
                  <Muted>
                    {ticket.mins} min · {ticket.ticketRef}
                  </Muted>
                </View>
                {(() => {
                  const total = kitchenTicketTotal(ticket, menuItems);
                  return (
                    <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "700", marginTop: 4 }}>
                      {total != null ? formatPkr(total) : "—"}
                    </Text>
                  );
                })()}
                {ticket.priority === "priority" ? (
                  <Text style={{ color: colors.warning, fontSize: 13 }}>Priority order</Text>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <Pressable
                    onPress={() => void handlePrint(ticket)}
                    disabled={isPrinting}
                    style={{
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: "#0b1220",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      opacity: isPrinting ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                      {isPrinting ? "Printing…" : "Print order"}
                    </Text>
                  </Pressable>
                  {canEdit ? (
                    <Pressable
                      onPress={() => openEdit(ticket)}
                      style={{
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
                  {canTransfer ? (
                    <Pressable
                      onPress={() => openTransfer(ticket)}
                      style={{
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "rgba(56, 189, 248, 0.45)",
                        backgroundColor: "rgba(56, 189, 248, 0.12)",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ color: "#38bdf8", fontWeight: "700", fontSize: 13 }}>
                        Table transfer
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {!ownsKitchenTicket(ticket, claims?.sub) ? (
                  <Text style={{ color: "#f87171", fontSize: 12, fontWeight: "600", marginTop: 6 }}>
                    Taken by {ticket.createdByName ?? "another waiter"} — view only
                  </Text>
                ) : !isDineIn && canEdit ? (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    Table transfer is only for dine-in orders
                  </Text>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
