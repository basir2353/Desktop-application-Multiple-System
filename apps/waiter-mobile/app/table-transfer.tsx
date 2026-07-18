import type { KitchenTicket } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchKitchenTickets, updateKitchenTicket } from "../src/api/kitchen";
import { fetchBranchFloor } from "../src/api/tables";
import {
  Button,
  Card,
  EmptyState,
  Notice,
  Screen,
  SectionHeader,
  StatusBadge,
  colors,
} from "../src/components/ui";
import {
  canTransferKitchenTicket,
  tableNumberFromStation,
  tableStationLabel,
} from "../src/lib/loadOrder";
import {
  formatTimeAgo,
  kitchenStatusLabel,
  orderRefFromTicket,
} from "../src/lib/orderDisplay";
import { resolveStaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type Step = "order" | "section" | "table";

export default function TableTransferScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ticketId: ticketIdParam } = useLocalSearchParams<{ ticketId?: string }>();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code ?? "";
  const userId = claims?.sub ?? null;

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(ticketIdParam ?? null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: 8_000,
  });

  const floorQuery = useQuery({
    queryKey: ["tables", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchFloor(branchCode),
  });

  const transferable = useMemo(() => {
    const tickets = kitchenQuery.data ?? [];
    return tickets
      .filter((ticket) => canTransferKitchenTicket(ticket, userId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [kitchenQuery.data, userId]);

  const selectedTicket =
    transferable.find((ticket) => ticket.id === selectedTicketId) ??
    (ticketIdParam
      ? (kitchenQuery.data ?? []).find((ticket) => ticket.id === ticketIdParam) ?? null
      : null);

  useEffect(() => {
    if (ticketIdParam) setSelectedTicketId(ticketIdParam);
  }, [ticketIdParam]);

  useEffect(() => {
    if (!selectedTicketId) return;
    if (transferable.some((ticket) => ticket.id === selectedTicketId)) return;
    if (kitchenQuery.isLoading) return;
    // Param pointed at a ticket we can't transfer — fall back to picker.
    if (ticketIdParam === selectedTicketId) {
      setSelectedTicketId(null);
      setError("This order cannot be transferred. Pick another dine-in order.");
    }
  }, [selectedTicketId, transferable, kitchenQuery.isLoading, ticketIdParam]);

  const sections = useMemo(
    () => (floorQuery.data?.sections ?? []).filter((s) => s.isActive),
    [floorQuery.data?.sections],
  );
  const tables = useMemo(
    () => (floorQuery.data?.tables ?? []).filter((t) => t.isActive),
    [floorQuery.data?.tables],
  );

  const sectionTables = selectedSectionId
    ? tables.filter((t) => t.sectionId === selectedSectionId)
    : tables;

  const currentTableNumber = selectedTicket
    ? tableNumberFromStation(selectedTicket.stationLabel)
    : null;

  const step: Step = !selectedTicket
    ? "order"
    : sections.length > 0 && !selectedSectionId
      ? "section"
      : "table";

  const transferMutation = useMutation({
    mutationFn: (tableNumber: string) =>
      updateKitchenTicket(selectedTicket!.id, {
        stationLabel: tableStationLabel(tableNumber),
      }),
    onSuccess: async (_ticket, tableNumber) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kitchen"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["tables"] }),
      ]);
      const ref = orderRefFromTicket(selectedTicket!);
      setNotice(`Moved ${ref} to ${tableStationLabel(tableNumber)}.`);
      setError(null);
      setSelectedTicketId(null);
      setSelectedSectionId(null);
    },
    onError: (err: Error) => {
      setError(err.message ?? "Could not transfer table.");
      setNotice(null);
    },
  });

  function pickTicket(ticket: KitchenTicket): void {
    setError(null);
    setNotice(null);
    setSelectedTicketId(ticket.id);
    setSelectedSectionId(null);
  }

  function pickTable(tableNumber: string): void {
    if (!selectedTicket) return;
    const nextLabel = tableStationLabel(tableNumber);
    if (nextLabel === selectedTicket.stationLabel.trim()) {
      setSelectedTicketId(null);
      setSelectedSectionId(null);
      return;
    }
    setError(null);
    transferMutation.mutate(tableNumber);
  }

  function refreshAll(): void {
    void kitchenQuery.refetch();
    void floorQuery.refetch();
  }

  if (!accessToken) return <Redirect href="/" />;
  if (resolveStaffRole(claims) === "rider") return <Redirect href="/rider-home" />;
  if (!branch) return <Redirect href="/branch" />;

  const refreshing = kitchenQuery.isFetching || floorQuery.isFetching;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing && !kitchenQuery.isLoading}
            onRefresh={refreshAll}
            tintColor={colors.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Move a dine-in order to another free table. Booked tables stay locked until their order is
          closed.
        </Text>

        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        {selectedTicket ? (
          <Card style={styles.selectedCard}>
            <View style={styles.selectedTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedRef}>{orderRefFromTicket(selectedTicket)}</Text>
                <Text style={styles.selectedMeta}>
                  Currently at {selectedTicket.stationLabel} ·{" "}
                  {kitchenStatusLabel(selectedTicket.status)}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setSelectedTicketId(null);
                  setSelectedSectionId(null);
                }}
                disabled={transferMutation.isPending}
                style={styles.changeBtn}
              >
                <Text style={styles.changeBtnText}>Change order</Text>
              </Pressable>
            </View>
            <Text style={styles.selectedItems} numberOfLines={2}>
              {selectedTicket.itemsSummary}
            </Text>
          </Card>
        ) : null}

        {step === "order" ? (
          <Card>
            <SectionHeader title="1. Select order" />
            {kitchenQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : transferable.length === 0 ? (
              <EmptyState
                title="No orders to transfer"
                message="Active dine-in orders you own will appear here. Takeaway and delivery cannot be table-transferred."
              />
            ) : (
              <View style={styles.list}>
                {transferable.map((ticket) => (
                  <Pressable
                    key={ticket.id}
                    onPress={() => pickTicket(ticket)}
                    style={({ pressed }) => [styles.orderRow, pressed && styles.pressed]}
                  >
                    <View style={styles.orderRowTop}>
                      <Text style={styles.orderRef}>{orderRefFromTicket(ticket)}</Text>
                      <StatusBadge status={kitchenStatusLabel(ticket.status)} />
                    </View>
                    <Text style={styles.orderStation}>{ticket.stationLabel}</Text>
                    <Text style={styles.orderItems} numberOfLines={1}>
                      {ticket.itemsSummary}
                    </Text>
                    <Text style={styles.orderWhen}>{formatTimeAgo(ticket.createdAt)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Card>
        ) : null}

        {step === "section" ? (
          <Card>
            <SectionHeader title="2. Select section" />
            {floorQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : sections.length === 0 ? (
              <EmptyState
                title="No sections"
                message="Configure seating sections in the desktop Tables module."
              />
            ) : (
              <View style={styles.sectionGrid}>
                {sections.map((section) => {
                  const count = tables.filter((t) => t.sectionId === section.id).length;
                  const empty = count === 0;
                  return (
                    <Pressable
                      key={section.id}
                      disabled={empty || transferMutation.isPending}
                      onPress={() => setSelectedSectionId(section.id)}
                      style={({ pressed }) => [
                        styles.sectionCard,
                        empty && styles.sectionCardDisabled,
                        pressed && !empty && styles.pressed,
                      ]}
                    >
                      <Text style={styles.sectionName}>{section.name}</Text>
                      <Text style={styles.sectionMeta}>
                        {empty ? "No tables" : `${count} table${count === 1 ? "" : "s"}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>
        ) : null}

        {step === "table" ? (
          <Card>
            <SectionHeader
              title={sections.length > 0 ? "3. Select new table" : "2. Select new table"}
              actionLabel={sections.length > 0 ? "All sections" : undefined}
              onAction={
                sections.length > 0
                  ? () => {
                      if (!transferMutation.isPending) setSelectedSectionId(null);
                    }
                  : undefined
              }
            />
            {floorQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : sectionTables.length === 0 ? (
              <EmptyState title="No tables" message="No tables available in this section." />
            ) : (
              <View style={styles.tableGrid}>
                {sectionTables.map((table) => {
                  const isCurrent =
                    currentTableNumber != null && table.tableNumber === currentTableNumber;
                  const booked = table.bookingStatus === "booked" && !isCurrent;
                  const disabled = transferMutation.isPending || booked;
                  return (
                    <Pressable
                      key={table.id}
                      disabled={disabled}
                      onPress={() => pickTable(table.tableNumber)}
                      style={({ pressed }) => [
                        styles.tableBtn,
                        isCurrent && styles.tableBtnCurrent,
                        booked && styles.tableBtnBooked,
                        pressed && !disabled && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tableLabel,
                          booked && styles.tableLabelMuted,
                          isCurrent && styles.tableLabelCurrent,
                        ]}
                      >
                        {table.tableNumber}
                      </Text>
                      <Text style={styles.tableMeta}>
                        {isCurrent
                          ? "Current"
                          : booked
                            ? table.bookedOrderRef
                              ? `Booked · ${table.bookedOrderRef}`
                              : "Booked"
                            : `${table.seats} seats`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {transferMutation.isPending ? (
              <View style={styles.pendingRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.pendingText}>Updating table…</Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Button label="Back to home" variant="ghost" onPress={() => router.replace("/home")} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 28 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  selectedCard: { gap: 8, borderColor: "rgba(245, 158, 11, 0.35)" },
  selectedTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  selectedRef: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "700",
  },
  selectedMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  selectedItems: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  changeBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  changeBtnText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  list: { gap: 8 },
  orderRow: {
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  orderRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  orderRef: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 15,
    fontWeight: "700",
  },
  orderStation: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  orderItems: { color: colors.muted, fontSize: 12 },
  orderWhen: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sectionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sectionCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  sectionCardDisabled: { opacity: 0.45 },
  sectionName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  sectionMeta: { color: colors.muted, fontSize: 12 },
  tableGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tableBtn: {
    width: "30%",
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 4,
  },
  tableBtnCurrent: {
    borderColor: "rgba(245, 158, 11, 0.55)",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  tableBtnBooked: {
    opacity: 0.5,
    borderColor: "rgba(248, 113, 113, 0.35)",
  },
  tableLabel: { color: colors.text, fontSize: 16, fontWeight: "800" },
  tableLabelCurrent: { color: colors.accent },
  tableLabelMuted: { color: colors.muted },
  tableMeta: { color: colors.muted, fontSize: 11, textAlign: "center" },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  pendingText: { color: colors.muted, fontSize: 13 },
  pressed: { opacity: 0.85 },
});
