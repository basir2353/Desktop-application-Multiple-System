import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchBranchMenu, updateMenuItem } from "../src/api/menu";
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
import { formatPkr } from "../src/lib/orderDisplay";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminMenuScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const menuQuery = useQuery({
    queryKey: ["admin", "menu", branchCode],
    queryFn: () => fetchBranchMenu(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      updateMenuItem(input.id, { isActive: input.isActive }),
    onSuccess: (item) => {
      setNotice(`${item.name} is now ${item.isActive ? "ON" : "OFF"} the menu`);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "menu", branchCode] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const categories = menuQuery.data?.categories ?? [];
  const items = useMemo(() => {
    let list = menuQuery.data?.items ?? [];
    if (categoryId !== "all") list = list.filter((i) => i.categoryId === categoryId);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.secondaryName ?? "").toLowerCase().includes(q) ||
          (i.barcode ?? "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [menuQuery.data?.items, categoryId, search]);

  if (!allowed) return <Redirect href="/" />;

  const activeCount = (menuQuery.data?.items ?? []).filter((i) => i.isActive).length;
  const offCount = (menuQuery.data?.items ?? []).length - activeCount;

  return (
    <AdminShell tab="menu" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={menuQuery.isFetching}
            onRefresh={() => void menuQuery.refetch()}
            tintColor={colors.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Title>Menu</Title>
        <Subtitle>
          {branchCode
            ? `Toggle items on/off for ${branchCode}`
            : "Select a branch on Home first"}
        </Subtitle>

        {!branchCode ? <Notice>Pick a branch on Home first.</Notice> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Active" value={activeCount} accent={colors.success} />
          <StatCard label="Hidden" value={Math.max(0, offCount)} accent={colors.muted} />
          <StatCard label="Categories" value={categories.length} />
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search items…"
          placeholderTextColor={colors.muted}
          style={{
            backgroundColor: colors.bg,
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
          <Chip label="All" selected={categoryId === "all"} onPress={() => setCategoryId("all")} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </ScrollView>

        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        <Card>
          {menuQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : items.length === 0 ? (
            <EmptyState title="No items" message="Nothing matches this filter." />
          ) : (
            items.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId)?.name ?? "—";
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {cat} · {formatPkr(item.price)}
                      {item.featured ? " · Featured" : ""}
                    </Text>
                  </View>
                  <Pressable
                    disabled={toggle.isPending}
                    onPress={() => toggle.mutate({ id: item.id, isActive: !item.isActive })}
                    style={{
                      minWidth: 72,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: item.isActive
                        ? "rgba(34, 197, 94, 0.18)"
                        : "rgba(148, 163, 184, 0.15)",
                      borderWidth: 1,
                      borderColor: item.isActive
                        ? "rgba(34, 197, 94, 0.45)"
                        : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: item.isActive ? colors.success : colors.muted,
                        fontWeight: "800",
                        fontSize: 12,
                      }}
                    >
                      {item.isActive ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </AdminShell>
  );
}
