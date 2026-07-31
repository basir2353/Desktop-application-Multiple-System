import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchBranchInventory } from "../src/api/inventory";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Card,
  Chip,
  EmptyState,
  Notice,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { formatPkr } from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type StockFilter = "all" | "low" | "out";

export default function AdminInventoryScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<StockFilter>("all");
  const [search, setSearch] = useState("");

  const invQuery = useQuery({
    queryKey: ["admin", "inventory", branchCode],
    queryFn: () => fetchBranchInventory(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  const ingredients = useMemo(() => {
    let list = invQuery.data?.ingredients ?? [];
    if (filter === "out") list = list.filter((i) => i.currentStock <= 0);
    if (filter === "low") {
      list = list.filter(
        (i) => i.currentStock > 0 && i.currentStock <= Math.max(i.reorderLevel, i.minStock),
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          (i.categoryName ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [invQuery.data?.ingredients, filter, search]);

  const all = invQuery.data?.ingredients ?? [];
  const lowCount = all.filter(
    (i) => i.currentStock > 0 && i.currentStock <= Math.max(i.reorderLevel, i.minStock),
  ).length;
  const outCount = all.filter((i) => i.currentStock <= 0).length;
  const value = all.reduce((s, i) => s + i.currentStock * i.unitCost, 0);

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
            refreshing={invQuery.isFetching}
            onRefresh={() => void invQuery.refetch()}
            tintColor={colors.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Title>Inventory</Title>
        <Subtitle>{branchCode ? `Stock · ${branchCode}` : "Select a branch on Home"}</Subtitle>

        {!branchCode ? <Notice>Pick a branch on Home first.</Notice> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="SKUs" value={all.length} />
          <StatCard label="Low" value={lowCount} accent={lowCount > 0 ? colors.warning : undefined} />
          <StatCard label="Out" value={outCount} accent={outCount > 0 ? colors.danger : undefined} />
        </View>
        <StatCard label="Est. value" value={formatPkr(value)} hint="Stock × unit cost" />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search SKU or name…"
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: "#020617",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            color: colors.text,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
          }}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label="Low stock" selected={filter === "low"} onPress={() => setFilter("low")} />
          <Chip label="Out of stock" selected={filter === "out"} onPress={() => setFilter("out")} />
        </ScrollView>

        <Card>
          {invQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : ingredients.length === 0 ? (
            <EmptyState title="No items" message="Nothing matches this filter." />
          ) : (
            ingredients.slice(0, 80).map((item) => {
              const low =
                item.currentStock > 0 &&
                item.currentStock <= Math.max(item.reorderLevel, item.minStock);
              const out = item.currentStock <= 0;
              return (
                <View
                  key={item.id}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{item.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {item.sku} · {item.categoryName ?? "—"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        color: out ? colors.danger : low ? colors.warning : colors.text,
                        fontWeight: "800",
                      }}
                    >
                      {item.currentStock} {item.unit}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      min {item.minStock}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        {invQuery.isError ? <Notice>{(invQuery.error as Error).message}</Notice> : null}
      </ScrollView>
    </AdminShell>
  );
}
