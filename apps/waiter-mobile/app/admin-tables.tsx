import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchBranchFloor } from "../src/api/tables";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Card,
  EmptyState,
  Notice,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminTablesScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();

  const floorQuery = useQuery({
    queryKey: ["admin", "tables", branchCode],
    queryFn: () => fetchBranchFloor(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 10_000,
  });

  const sectionName = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of floorQuery.data?.sections ?? []) map.set(s.id, s.name);
    return map;
  }, [floorQuery.data?.sections]);

  const tables = useMemo(
    () =>
      [...(floorQuery.data?.tables ?? [])]
        .filter((t) => t.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.tableNumber.localeCompare(b.tableNumber)),
    [floorQuery.data?.tables],
  );

  const booked = tables.filter((t) => t.bookingStatus === "booked").length;
  const free = tables.length - booked;

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
            refreshing={floorQuery.isFetching}
            onRefresh={() => void floorQuery.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Title>Tables</Title>
        <Subtitle>{branchCode ? `Floor · ${branchCode}` : "Select a branch on Home"}</Subtitle>

        {!branchCode ? <Notice>Pick a branch on Home first.</Notice> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Total" value={tables.length} />
          <StatCard label="Free" value={free} accent={colors.success} />
          <StatCard
            label="Booked"
            value={booked}
            accent={booked > 0 ? colors.warning : undefined}
          />
        </View>

        <Card>
          {floorQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : tables.length === 0 ? (
            <EmptyState title="No tables" message="This branch has no floor layout yet." />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {tables.map((t) => {
                const busy = t.bookingStatus === "booked";
                return (
                  <View
                    key={t.id}
                    style={{
                      width: "30%",
                      minWidth: 96,
                      flexGrow: 1,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: busy ? "rgba(245, 158, 11, 0.5)" : colors.border,
                      backgroundColor: busy ? "rgba(245, 158, 11, 0.12)" : "#020617",
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "800" }}>{t.tableNumber}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {sectionName.get(t.sectionId) ?? "Section"} · {t.seats} seats
                    </Text>
                    <Text
                      style={{
                        color: busy ? colors.accent : colors.success,
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {busy ? t.bookedOrderRef || "Booked" : "Free"}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        {floorQuery.isError ? <Notice>{(floorQuery.error as Error).message}</Notice> : null}
      </ScrollView>
    </AdminShell>
  );
}
