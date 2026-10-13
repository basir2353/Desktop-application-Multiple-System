import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  fetchBranchMenu,
  updateMenuItem,
} from "../src/api/menu";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
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
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  const menuQuery = useQuery({
    queryKey: ["admin", "menu", branchCode],
    queryFn: () => fetchBranchMenu(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  function invalidate(): void {
    void qc.invalidateQueries({ queryKey: ["admin", "menu", branchCode] });
  }

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      updateMenuItem(input.id, { isActive: input.isActive }),
    onSuccess: (item) => {
      setNotice(`${item.name} is now ${item.isActive ? "ON" : "OFF"} the menu`);
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const addCategory = useMutation({
    mutationFn: () => {
      if (!branchCode) throw new Error("Select a branch first");
      const name = newCategoryName.trim();
      if (!name) throw new Error("Category name required");
      return createMenuCategory({ branchCode, name });
    },
    onSuccess: (cat) => {
      setNotice(`Category “${cat.name}” added`);
      setError(null);
      setNewCategoryName("");
      setShowAddCategory(false);
      setCategoryId(cat.id);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => deleteMenuCategory(id),
    onSuccess: () => {
      setNotice("Category deleted");
      setError(null);
      setCategoryId("all");
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const addItem = useMutation({
    mutationFn: () => {
      if (!branchCode) throw new Error("Select a branch first");
      const name = newItemName.trim();
      const price = Math.round(Number(newItemPrice));
      if (!name) throw new Error("Item name required");
      if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price (Rs)");
      const catId = categoryId === "all" ? menuQuery.data?.categories[0]?.id : categoryId;
      if (!catId) throw new Error("Add a category first, then add items");
      return createMenuItem({
        branchCode,
        categoryId: catId,
        name,
        price,
        simplePrice: true,
      });
    },
    onSuccess: (item) => {
      setNotice(`“${item.name}” added at ${formatPkr(item.price)}`);
      setError(null);
      setNewItemName("");
      setNewItemPrice("");
      setShowAddItem(false);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => {
      setNotice("Item deleted");
      setError(null);
      invalidate();
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

  function confirmDeleteItem(id: string, name: string): void {
    Alert.alert("Delete item", `Delete “${name}”? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeItem.mutate(id),
      },
    ]);
  }

  function confirmDeleteCategory(id: string, name: string): void {
    Alert.alert(
      "Delete category",
      `Delete category “${name}”? Items in it may need to be removed first.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeCategory.mutate(id),
        },
      ],
    );
  }

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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Title>Menu control</Title>
            <Subtitle>
              {branchCode
                ? `Add · delete · on/off for ${branchCode}`
                : "Select a branch on Home first"}
            </Subtitle>
          </View>
        </View>

        {!branchCode ? <Notice>Pick a branch on Home first.</Notice> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Active" value={activeCount} accent={colors.success} />
          <StatCard label="Hidden" value={Math.max(0, offCount)} accent={colors.muted} />
          <StatCard label="Categories" value={categories.length} />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              setShowAddCategory((v) => !v);
              setShowAddItem(false);
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: "rgba(15, 118, 110, 0.18)",
              borderWidth: 1,
              borderColor: "rgba(20, 184, 166, 0.4)",
            }}
          >
            <Text style={{ color: colors.accentSoft, fontWeight: "800", fontSize: 13 }}>
              + Category
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowAddItem((v) => !v);
              setShowAddCategory(false);
            }}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.accent,
            }}
          >
            <Text style={{ color: colors.accentText, fontWeight: "800", fontSize: 13 }}>
              + Item
            </Text>
          </Pressable>
        </View>

        {showAddCategory ? (
          <Card>
            <Text style={{ color: colors.text, fontWeight: "800", marginBottom: 8 }}>
              New category
            </Text>
            <Input
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="e.g. BBQ, Beverages"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Add category"
                  onPress={() => addCategory.mutate()}
                  loading={addCategory.isPending}
                  disabled={!branchCode || addCategory.isPending}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setShowAddCategory(false)} />
              </View>
            </View>
          </Card>
        ) : null}

        {showAddItem ? (
          <Card>
            <Text style={{ color: colors.text, fontWeight: "800", marginBottom: 4 }}>
              New item
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>
              {categoryId === "all"
                ? "Will use the first category — or pick a category chip below"
                : `Category: ${categories.find((c) => c.id === categoryId)?.name ?? "—"}`}
            </Text>
            <Input
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Item name"
            />
            <View style={{ height: 8 }} />
            <Input
              value={newItemPrice}
              onChangeText={setNewItemPrice}
              placeholder="Price (Rs)"
              keyboardType="numeric"
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Add item"
                  onPress={() => addItem.mutate()}
                  loading={addItem.isPending}
                  disabled={!branchCode || addItem.isPending}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" onPress={() => setShowAddItem(false)} />
              </View>
            </View>
          </Card>
        ) : null}

        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search items…"
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

        {categoryId !== "all" ? (
          <Pressable
            onPress={() => {
              const cat = categories.find((c) => c.id === categoryId);
              if (cat) confirmDeleteCategory(cat.id, cat.name);
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 12 }}>
              Delete selected category
            </Text>
          </Pressable>
        ) : null}

        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        <Card>
          {menuQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : items.length === 0 ? (
            <EmptyState title="No items" message="Add a category, then add items." />
          ) : (
            items.map((item) => {
              const cat = categories.find((c) => c.id === item.categoryId)?.name ?? "—";
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
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
                      minWidth: 56,
                      paddingHorizontal: 10,
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
                        fontSize: 11,
                      }}
                    >
                      {item.isActive ? "ON" : "OFF"}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={removeItem.isPending}
                    onPress={() => confirmDeleteItem(item.id, item.name)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "rgba(239, 68, 68, 0.45)",
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                    }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: "800", fontSize: 11 }}>
                      Del
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
