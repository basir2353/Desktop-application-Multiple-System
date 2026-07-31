import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
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
  formatTimeAgo,
  kitchenStatusLabel,
  orderRefFromTicket,
} from "../src/lib/orderDisplay";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type StatusFilter = "active" | "new" | "cooking" | "ready" | "done";

export default function AdminKitchenScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [error, setError] = useState<string | null>(null);

  const kitchenQuery = useQuery({
    queryKey: ["admin", "kitchen", branchCode],
    queryFn: () => fetchKitchenTickets(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 4_000,
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

  const tickets = useMemo(() => {
    const list = [...(kitchenQuery.data ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    if (filter === "active") return list.filter((t) => t.status !== "done");
    return list.filter((t) => t.status === filter);
  }, [kitchenQuery.data, filter]);

  const counts = useMemo(() => {
    const all = kitchenQuery.data ?? [];
    return {
      new: all.filter((t) => t.status === "new").length,
      cooking: all.filter((t) => t.status === "cooking").length,
      ready: all.filter((t) => t.status === "ready").length,
    };
  }, [kitchenQuery.data]);

  if (!allowed) return <Redirect href="/" />;

  return (
    <AdminShell tab="more" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={kitchenQuery.isFetching}
            onRefresh={() => void kitchenQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Title>Kitchen</Title>
        <Subtitle>{branchCode ? `Queue · ${branchCode}` : "Select a branch on Home"}</Subtitle>

        {!branchCode ? <Notice>Pick a branch on Home first.</Notice> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="New" value={counts.new} />
          <StatCard label="Cooking" value={counts.cooking} accent="#38bdf8" />
          <StatCard label="Ready" value={counts.ready} accent={colors.success} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(
            [
              ["active", "Active"],
              ["new", "New"],
              ["cooking", "Cooking"],
              ["ready", "Ready"],
              ["done", "Done"],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} label={label} selected={filter === id} onPress={() => setFilter(id)} />
          ))}
        </ScrollView>

        {error ? <Notice>{error}</Notice> : null}

        <Card>
          {kitchenQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : tickets.length === 0 ? (
            <EmptyState title="No tickets" message="Nothing in this filter." />
          ) : (
            tickets.slice(0, 50).map((ticket) => {
              const next =
                ticket.status === "new"
                  ? "cooking"
                  : ticket.status === "cooking"
                    ? "ready"
                    : ticket.status === "ready"
                      ? "done"
                      : null;
              return (
                <View
                  key={ticket.id}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {orderRefFromTicket(ticket)}
                        {ticket.priority === "priority" ? " · PRIORITY" : ""}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {formatTimeAgo(ticket.createdAt)} · {ticket.stationLabel} · {ticket.mins}m
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {ticket.itemsSummary}
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
                        paddingHorizontal: 14,
                        paddingVertical: 9,
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
      </ScrollView>
    </AdminShell>
  );
}
