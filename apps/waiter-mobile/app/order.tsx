import { formatMenuItemLabel, type Bill, type KitchenTicket, type MenuItem } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createBill, fetchOrders, updateBill } from "../src/api/billing";
import { createKitchenTicket, fetchKitchenTickets, updateKitchenTicket } from "../src/api/kitchen";
import { fetchRiders } from "../src/api/delivery";
import { fetchBranchMenu } from "../src/api/menu";
import { fetchBranchFloor } from "../src/api/tables";
import {
  Button,
  Card,
  CategoryHeading,
  Chip,
  EmptyState,
  Input,
  Muted,
  Notice,
  QtyStepper,
  Screen,
  SectionHeader,
  StatusBadge,
  colors,
} from "../src/components/ui";
import { formatPkr, formatTimeAgo, kitchenStatusLabel } from "../src/lib/orderDisplay";
import { matchesTable, newOrderRef, type CartLine, type TableDraft } from "../src/lib/orderDrafts";
import {
  canEditHeldBill,
  canEditKitchenTicket,
  cartFromBill,
  cartFromKitchenTicket,
  extractKitchenNotes,
  resolveTableKey,
  type EditingOrder,
} from "../src/lib/loadOrder";
import { useBranchStore } from "../src/stores/branchStore";
import {
  deliveryNotes,
  inferOrderModeFromStation,
  MOBILE_ORDER_MODES,
  stationLabelForMode,
  type MobileOrderMode,
} from "../src/lib/orderMode";
import { resolveStaffRole } from "../src/lib/roles";
import { useSessionStore } from "../src/stores/sessionStore";

const SERVICE_PCT = 10;

function emptyDraft(orderRef: string): TableDraft {
  return { cart: [], notes: "", orderRef };
}

function kitchenAccent(status: string): string {
  if (status === "ready") return colors.success;
  if (status === "cooking") return "#38bdf8";
  return colors.warning;
}

export default function OrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editTicketId?: string; editBillId?: string }>();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);

  const branchCode = branch?.code ?? "";
  const [tableId, setTableId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({});
  const [editingOrder, setEditingOrder] = useState<EditingOrder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState<MobileOrderMode>("dine-in");
  const [deliveryCustomer, setDeliveryCustomer] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryRiderId, setDeliveryRiderId] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const appliedEditRef = useRef<string | null>(null);

  const floorQuery = useQuery({
    queryKey: ["tables", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchFloor(branchCode),
  });

  const menuQuery = useQuery({
    queryKey: ["menu", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchMenu(branchCode),
  });

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: 5_000,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchOrders(branchCode),
  });

  const ridersQuery = useQuery({
    queryKey: ["delivery-riders", branchCode],
    enabled: Boolean(branchCode) && orderMode === "delivery",
    queryFn: () => fetchRiders(branchCode),
  });

  const tables = useMemo(() => {
    return (floorQuery.data?.tables ?? []).filter((t) => t.isActive);
  }, [floorQuery.data]);

  const activeTableId = tableId ?? tables[0]?.tableNumber ?? null;
  const draftKey = orderMode === "dine-in" ? activeTableId : orderMode;
  const activeRiders = useMemo(
    () => (ridersQuery.data ?? []).filter((rider) => rider.active),
    [ridersQuery.data],
  );

  const currentDraft =
    draftKey && drafts[draftKey]
      ? drafts[draftKey]
      : emptyDraft(newOrderRef());

  const cart = currentDraft.cart;
  const notes = currentDraft.notes;
  const orderRef = currentDraft.orderRef;

  function updateDraft(patch: Partial<TableDraft>): void {
    if (!draftKey) return;
    setDrafts((prev) => ({
      ...prev,
      [draftKey]: { ...(prev[draftKey] ?? emptyDraft(orderRef)), ...patch },
    }));
  }

  function combinedOrderNotes(): string | undefined {
    const delivery = orderMode === "delivery" ? deliveryNotes(deliveryCustomer, deliveryPhone, deliveryAddress) : undefined;
    const kitchen = notes.trim();
    if (delivery && kitchen) return `${delivery} · ${kitchen}`;
    return delivery ?? (kitchen || undefined);
  }

  function validateOrderTarget(): string | null {
    if (orderMode === "dine-in" && !activeTableId) return "Select a table first.";
    if (orderMode === "delivery") {
      if (activeRiders.length === 0) return "Add an active rider in the desktop Delivery module first.";
      if (!deliveryRiderId) return "Select a rider for this delivery order.";
    }
    return null;
  }

  function cartLines() {
    return cart.map((line) => ({
      label: formatMenuItemLabel(line.item),
      qty: line.qty,
      unitPrice: line.item.price,
      menuItemId: line.item.id,
    }));
  }

  function invalidateOrderFeeds(): void {
    void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  function applyTicketEdit(ticket: KitchenTicket): void {
    const mode = inferOrderModeFromStation(ticket.stationLabel);
    const tableKey = mode === "dine-in" ? resolveTableKey(ticket.stationLabel) : mode;
    const loadedCart = cartFromKitchenTicket(menuItems, ticket);
    setOrderMode(mode);
    setEditingOrder({ kind: "ticket", ticketId: ticket.id });
    setTableId(mode === "dine-in" ? tableKey : null);
    setDeliveryRiderId(ticket.riderId ?? "");
    setDeliveryCharge(String(ticket.deliveryChargePkr ?? 0));
    setDrafts((prev) => ({
      ...prev,
      [tableKey]: {
        cart: loadedCart,
        notes: extractKitchenNotes(ticket),
        orderRef: ticket.orderRef ?? ticket.ticketRef,
      },
    }));
    setShowMenu(true);
    setNotice("Editing order — add or remove items, then tap Update order.");
  }

  function applyBillEdit(bill: Bill): void {
    const tableKey = resolveTableKey(bill.tableLabel);
    const loadedCart = cartFromBill(menuItems, bill);
    setEditingOrder({ kind: "bill", billId: bill.id });
    setTableId(tableKey);
    setDrafts((prev) => ({
      ...prev,
      [tableKey]: {
        cart: loadedCart,
        notes: bill.notes?.trim() ?? "",
        orderRef: bill.orderRef ?? bill.billRef,
      },
    }));
    setShowMenu(true);
    setNotice("Editing held bill — update items, then save changes.");
  }

  function cancelEdit(): void {
    setEditingOrder(null);
    appliedEditRef.current = null;
    if (draftKey) {
      setDrafts((prev) => ({
        ...prev,
        [draftKey]: emptyDraft(newOrderRef()),
      }));
    }
    setShowMenu(false);
    setNotice(null);
    router.replace("/order");
  }

  const menuItems = menuQuery.data?.items.filter((m) => m.isActive) ?? [];

  const categories = useMemo(() => {
    return (menuQuery.data?.categories ?? [])
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [menuQuery.data?.categories]);

  const menuByCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    const filtered = menuItems.filter((m) => {
      if (!q && categoryFilter && m.categoryId !== categoryFilter) return false;
      if (!q) return true;
      const catName = categoryNameById.get(m.categoryId)?.toLowerCase() ?? "";
      return (
        m.name.toLowerCase().includes(q) ||
        formatMenuItemLabel(m).toLowerCase().includes(q) ||
        catName.includes(q)
      );
    });

    const byCategory = new Map<string, MenuItem[]>();
    for (const item of filtered) {
      const list = byCategory.get(item.categoryId) ?? [];
      list.push(item);
      byCategory.set(item.categoryId, list);
    }
    for (const [id, items] of byCategory) {
      byCategory.set(
        id,
        items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
      );
    }

    const sections: { categoryId: string; name: string; items: MenuItem[] }[] = [];
    for (const cat of categories) {
      const items = byCategory.get(cat.id);
      if (items?.length) {
        sections.push({ categoryId: cat.id, name: cat.name, items });
        byCategory.delete(cat.id);
      }
    }
    for (const [catId, items] of byCategory) {
      if (items.length) {
        sections.push({
          categoryId: catId,
          name: categoryNameById.get(catId) ?? "Other",
          items,
        });
      }
    }
    return sections;
  }, [menuItems, categories, search, categoryFilter]);

  const cartQty = cart.reduce((sum, line) => sum + line.qty, 0);

  const tableKots = (kitchenQuery.data ?? []).filter((k) =>
    activeTableId ? matchesTable(k.stationLabel, activeTableId) : false,
  );

  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0);
  const service = Math.round(subtotal * (SERVICE_PCT / 100));
  const tax = Math.round((subtotal + service) * 0.15);
  const total = subtotal + service + tax;

  const editTicketId = typeof params.editTicketId === "string" ? params.editTicketId : undefined;
  const editBillId = typeof params.editBillId === "string" ? params.editBillId : undefined;

  useEffect(() => {
    if (menuItems.length === 0) return;
    const key = editTicketId ?? editBillId ?? null;
    if (!key || appliedEditRef.current === key) return;

    if (editTicketId) {
      const ticket = kitchenQuery.data?.find((row) => row.id === editTicketId);
      if (ticket && canEditKitchenTicket(ticket)) {
        applyTicketEdit(ticket);
        appliedEditRef.current = key;
      }
      return;
    }

    if (editBillId) {
      const bill = ordersQuery.data?.find((row) => row.id === editBillId);
      if (bill && canEditHeldBill(bill)) {
        applyBillEdit(bill);
        appliedEditRef.current = key;
      }
    }
  }, [menuItems.length, kitchenQuery.data, ordersQuery.data, editTicketId, editBillId]);

  const sendMutation = useMutation({
    mutationFn: () => {
      if (cart.length === 0) throw new Error("Add at least one item.");
      const targetErr = validateOrderTarget();
      if (targetErr) throw new Error(targetErr);
      const lines = cartLines();
      const stationLabel = stationLabelForMode(orderMode, activeTableId);
      const payloadNotes = combinedOrderNotes();
      const deliveryExtras =
        orderMode === "delivery"
          ? {
              riderId: deliveryRiderId,
              deliveryChargePkr: Math.max(0, Number(deliveryCharge) || 0),
            }
          : {};
      if (editingOrder?.kind === "ticket") {
        return updateKitchenTicket(editingOrder.ticketId, {
          stationLabel,
          lines,
          notes: payloadNotes ?? null,
          ...deliveryExtras,
        });
      }
      return createKitchenTicket({
        branchCode,
        orderRef,
        stationLabel,
        notes: payloadNotes,
        lines,
        ...deliveryExtras,
      });
    },
    onSuccess: () => {
      const wasEdit = editingOrder?.kind === "ticket";
      updateDraft({ cart: [], notes: "" });
      setEditingOrder(null);
      appliedEditRef.current = null;
      setShowMenu(false);
      invalidateOrderFeeds();
      setNotice(wasEdit ? "Order updated successfully." : "Order sent to kitchen successfully.");
      if (wasEdit) router.replace("/order");
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const billMutation = useMutation({
    mutationFn: () => {
      if (cart.length === 0) throw new Error("Add at least one item.");
      const targetErr = validateOrderTarget();
      if (targetErr) throw new Error(targetErr);
      const lines = cartLines();
      const tableLabel = stationLabelForMode(orderMode, activeTableId);
      const payloadNotes = combinedOrderNotes();
      if (editingOrder?.kind === "bill") {
        return updateBill(editingOrder.billId, {
          tableLabel,
          lines,
          notes: payloadNotes ?? null,
          servicePct: SERVICE_PCT,
          riderId: orderMode === "delivery" ? deliveryRiderId || null : null,
          deliveryChargePkr: orderMode === "delivery" ? Math.max(0, Number(deliveryCharge) || 0) : 0,
        });
      }
      return createBill({
        branchCode,
        orderRef,
        tableLabel,
        waiterId: claims?.sub,
        lines,
        notes: payloadNotes,
        servicePct: SERVICE_PCT,
        riderId: orderMode === "delivery" ? deliveryRiderId || undefined : undefined,
        deliveryChargePkr: orderMode === "delivery" ? Math.max(0, Number(deliveryCharge) || 0) : undefined,
      });
    },
    onSuccess: (bill) => {
      const wasEdit = editingOrder?.kind === "bill";
      updateDraft({ cart: [], notes: "" });
      setEditingOrder(null);
      appliedEditRef.current = null;
      invalidateOrderFeeds();
      setNotice(
        wasEdit ? `Held bill ${bill.billRef} updated.` : `Bill ${bill.billRef} created successfully.`,
      );
      if (wasEdit) router.replace("/order");
    },
    onError: (err: Error) => setNotice(err.message),
  });

  function addToCart(item: MenuItem): void {
    const next = [...cart];
    const i = next.findIndex((l) => l.item.id === item.id);
    if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + 1 };
    else next.push({ item, qty: 1 });
    updateDraft({ cart: next });
    setNotice(null);
  }

  function setLineQty(itemId: string, qty: number): void {
    const next =
      qty <= 0
        ? cart.filter((l) => l.item.id !== itemId)
        : cart.map((l) => (l.item.id === itemId ? { ...l, qty } : l));
    updateDraft({ cart: next });
  }

  function selectMode(mode: MobileOrderMode): void {
    if (editingOrder) return;
    setOrderMode(mode);
    setNotice(null);
    if (mode !== "dine-in") {
      setTableId(null);
      setDrafts((prev) => ({
        ...prev,
        [mode]: prev[mode] ?? emptyDraft(newOrderRef()),
      }));
    }
  }

  function selectTable(tableNumber: string): void {
    if (editingOrder) return;
    setTableId(tableNumber);
    setShowMenu(false);
    setNotice(null);
    if (!drafts[tableNumber]) {
      setDrafts((prev) => ({
        ...prev,
        [tableNumber]: emptyDraft(newOrderRef()),
      }));
    }
  }

  function startEditTicket(ticket: KitchenTicket): void {
    if (!canEditKitchenTicket(ticket)) return;
    applyTicketEdit(ticket);
    appliedEditRef.current = ticket.id;
  }

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (resolveStaffRole(claims) === "rider") {
    return <Redirect href="/rider-home" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View style={styles.topBarCopy}>
            <Text style={styles.branchName}>{branch.name}</Text>
            <Text style={styles.branchMeta}>
              {branch.code}
              {orderMode === "dine-in" && activeTableId ? ` · Table ${activeTableId}` : ""}
              {orderMode === "takeaway" ? " · Takeaway" : ""}
              {orderMode === "delivery" ? " · Delivery" : ""}
            </Text>
          </View>
          <View style={styles.refBadge}>
            <Text style={styles.refLabel}>Ref</Text>
            <Text style={styles.refValue}>{orderRef}</Text>
          </View>
        </View>

        {notice ? (
          <Notice
            tone={
              notice.includes("success") ||
              notice.includes("created") ||
              notice.includes("updated")
                ? "success"
                : "warning"
            }
          >
            {notice}
          </Notice>
        ) : null}

        {editingOrder ? (
          <View style={styles.editBanner}>
            <View style={styles.editBannerCopy}>
              <Text style={styles.editBannerTitle}>
                {editingOrder.kind === "ticket" ? "Editing kitchen order" : "Editing held bill"}
              </Text>
              <Text style={styles.editBannerHint}>Add or remove items, then save your changes.</Text>
            </View>
            <Pressable onPress={cancelEdit} style={styles.editCancelBtn}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <Card style={styles.sectionCard}>
          <SectionHeader title="Order type" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableRow}>
            {MOBILE_ORDER_MODES.map((mode) => (
              <Chip
                key={mode.id}
                label={mode.label}
                selected={orderMode === mode.id}
                onPress={() => selectMode(mode.id)}
              />
            ))}
          </ScrollView>
        </Card>

        {orderMode === "dine-in" ? (
        <Card style={styles.sectionCard}>
          <SectionHeader title={editingOrder ? "Table (locked)" : "Select table"} />
          {floorQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : tables.length === 0 ? (
            <EmptyState
              title="No tables"
              message="Configure tables in the desktop app to start taking orders."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableRow}
            >
              {tables.map((t) => (
                <Chip
                  key={t.id}
                  label={t.tableNumber}
                  selected={activeTableId === t.tableNumber}
                  onPress={() => selectTable(t.tableNumber)}
                />
              ))}
            </ScrollView>
          )}
        </Card>
        ) : null}

        {orderMode === "delivery" ? (
          <Card style={styles.sectionCard}>
            <SectionHeader title="Delivery details" />
            <Input
              placeholder="Customer name"
              value={deliveryCustomer}
              onChangeText={setDeliveryCustomer}
              style={styles.deliveryInput}
            />
            <Input
              placeholder="Phone"
              value={deliveryPhone}
              onChangeText={setDeliveryPhone}
              keyboardType="phone-pad"
              style={styles.deliveryInput}
            />
            <Input
              placeholder="Delivery address"
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              style={styles.deliveryInput}
            />
            {ridersQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : activeRiders.length === 0 ? (
              <Muted>Add active riders in the desktop Delivery module for this branch.</Muted>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableRow}>
                {activeRiders.map((rider) => (
                  <Chip
                    key={rider.id}
                    label={rider.name}
                    selected={deliveryRiderId === rider.id}
                    onPress={() => setDeliveryRiderId(rider.id)}
                  />
                ))}
              </ScrollView>
            )}
            <Input
              placeholder="Delivery charge (PKR)"
              value={deliveryCharge}
              onChangeText={setDeliveryCharge}
              keyboardType="number-pad"
              style={styles.deliveryInput}
            />
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {editingOrder ? "Editing order" : "Current order"}
              </Text>
              <Text style={styles.sectionHint}>
                {cartQty === 0
                  ? "Add items from the menu below"
                  : `${cartQty} item${cartQty === 1 ? "" : "s"}`}
              </Text>
            </View>
            {cart.length > 0 ? (
              <Text style={styles.orderTotal}>{formatPkr(subtotal)}</Text>
            ) : null}
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartIcon}>🍽</Text>
              <Text style={styles.emptyCartText}>Your cart is empty</Text>
            </View>
          ) : (
            <View style={styles.cartList}>
              {cart.map((line: CartLine) => (
                <View key={line.item.id} style={styles.cartLine}>
                  <View style={styles.cartLineCopy}>
                    <Text style={styles.cartLineName} numberOfLines={2}>
                      {formatMenuItemLabel(line.item)}
                    </Text>
                    <Text style={styles.cartLinePrice}>
                      {formatPkr(line.item.price * line.qty)}
                    </Text>
                  </View>
                  <QtyStepper
                    qty={line.qty}
                    onDecrement={() => setLineQty(line.item.id, line.qty - 1)}
                    onIncrement={() => setLineQty(line.item.id, line.qty + 1)}
                  />
                </View>
              ))}
            </View>
          )}

          <View style={styles.notesWrap}>
            <Text style={styles.fieldLabel}>Kitchen notes</Text>
            <TextInput
              placeholder="Special instructions, allergies, spice level…"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={(text) => updateDraft({ notes: text })}
              multiline
              style={styles.notesInput}
            />
          </View>

          <View style={styles.actionRow}>
            <View style={styles.actionHalf}>
              <Button
                label={showMenu ? "Close menu" : "Browse menu"}
                variant="ghost"
                onPress={() => setShowMenu((v) => !v)}
              />
            </View>
            {editingOrder?.kind !== "bill" ? (
            <View style={styles.actionHalf}>
              <Button
                label={
                  sendMutation.isPending
                    ? "Saving…"
                    : editingOrder?.kind === "ticket"
                      ? "Update order"
                      : "Send to kitchen"
                }
                onPress={() => sendMutation.mutate()}
                disabled={cart.length === 0 || Boolean(validateOrderTarget())}
                loading={sendMutation.isPending}
              />
            </View>
            ) : null}
          </View>
        </Card>

        {showMenu ? (
          <Card style={styles.menuCard}>
            <SectionHeader title="Menu" actionLabel="Close" onAction={() => setShowMenu(false)} />

            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>⌕</Text>
              <Input
                placeholder="Search dishes or categories…"
                value={search}
                onChangeText={(text) => {
                  setSearch(text);
                  if (text.trim()) setCategoryFilter(null);
                }}
                style={styles.searchInput}
              />
            </View>

            {!search.trim() && categories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                <Chip
                  label="All"
                  selected={categoryFilter === null}
                  onPress={() => setCategoryFilter(null)}
                />
                {categories.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={cat.name}
                    selected={categoryFilter === cat.id}
                    onPress={() => setCategoryFilter(cat.id)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {menuQuery.isLoading ? (
              <View style={styles.menuLoading}>
                <ActivityIndicator color={colors.accent} />
                <Muted>Loading menu…</Muted>
              </View>
            ) : null}

            {!menuQuery.isLoading && menuByCategory.length === 0 ? (
              <EmptyState
                title="Nothing found"
                message={search.trim() ? "Try a different search term." : "No menu items available for this branch."}
              />
            ) : null}

            {menuByCategory.map((section) => (
              <View key={section.categoryId} style={styles.menuSection}>
                <CategoryHeading title={section.name} count={section.items.length} />
                {section.items.map((item) => {
                  const inCart = cart.find((l) => l.item.id === item.id)?.qty ?? 0;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => addToCart(item)}
                      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    >
                      <View style={styles.menuItemCopy}>
                        <Text style={styles.menuItemName} numberOfLines={2}>
                          {formatMenuItemLabel(item)}
                        </Text>
                        <Text style={styles.menuItemPrice}>{formatPkr(item.price)}</Text>
                      </View>
                      <View style={[styles.addBtn, inCart > 0 && styles.addBtnActive]}>
                        <Text style={[styles.addBtnText, inCart > 0 && styles.addBtnTextActive]}>
                          {inCart > 0 ? inCart : "+"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Card>
        ) : null}

        {orderMode === "dine-in" ? (
        <Card style={styles.sectionCard}>
          <SectionHeader title="Kitchen status" />
          {kitchenQuery.isLoading ? <Muted>Checking kitchen…</Muted> : null}
          {!kitchenQuery.isLoading && tableKots.length === 0 ? (
            <View style={styles.kitchenEmpty}>
              <Text style={styles.kitchenEmptyText}>No active ticket for this table</Text>
            </View>
          ) : (
            tableKots.map((k) => {
              const isEditingThis =
                editingOrder?.kind === "ticket" && editingOrder.ticketId === k.id;
              const canEdit = canEditKitchenTicket(k);
              return (
              <View
                key={k.id}
                style={[
                  styles.kitchenTicket,
                  { borderLeftColor: kitchenAccent(k.status) },
                  isEditingThis && styles.kitchenTicketEditing,
                ]}
              >
                <View style={styles.kitchenTicketTop}>
                  <View>
                    <Text style={styles.kitchenRef}>{k.ticketRef}</Text>
                    <Text style={styles.kitchenMeta}>
                      {kitchenStatusLabel(k.status)} · {formatTimeAgo(k.createdAt)}
                    </Text>
                  </View>
                  <StatusBadge status={kitchenStatusLabel(k.status)} />
                </View>
                <Text style={styles.kitchenItems} numberOfLines={2}>
                  {k.itemsSummary}
                </Text>
                {canEdit && !editingOrder ? (
                  <Pressable onPress={() => startEditTicket(k)} style={styles.editOrderBtn}>
                    <Text style={styles.editOrderBtnText}>Edit order</Text>
                  </Pressable>
                ) : null}
                {isEditingThis ? (
                  <Text style={styles.editingLabel}>Currently editing</Text>
                ) : null}
              </View>
            );
            })
          )}
        </Card>
        ) : null}

        <Card style={styles.billCard}>
          {cart.length > 0 ? (
            <View style={styles.billBreakdown}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Subtotal</Text>
                <Text style={styles.billValue}>{formatPkr(subtotal)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Service ({SERVICE_PCT}%)</Text>
                <Text style={styles.billValue}>{formatPkr(service)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Tax (15%)</Text>
                <Text style={styles.billValue}>{formatPkr(tax)}</Text>
              </View>
              <View style={[styles.billRow, styles.billTotalRow]}>
                <Text style={styles.billTotalLabel}>Total</Text>
                <Text style={styles.billTotalValue}>{formatPkr(total)}</Text>
              </View>
            </View>
          ) : null}

          <Button
            label={
              billMutation.isPending
                ? "Saving…"
                : editingOrder?.kind === "bill"
                  ? `Update hold · ${formatPkr(total)}`
                  : cart.length > 0
                    ? `Create bill · ${formatPkr(total)}`
                    : "Create bill"
            }
            onPress={() => billMutation.mutate()}
            disabled={cart.length === 0 || Boolean(validateOrderTarget())}
            loading={billMutation.isPending}
          />
        </Card>

        <View style={styles.footer}>
          <Pressable onPress={() => router.push("/home")} style={styles.footerLink}>
            <Text style={styles.footerText}>← Dashboard</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              clearBranch();
              router.replace("/branch");
            }}
            style={styles.footerLink}
          >
            <Text style={styles.footerText}>Branch</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              clearSession();
              clearBranch();
              router.replace("/");
            }}
            style={styles.footerLink}
          >
            <Text style={styles.footerText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 36,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  topBarCopy: {
    flex: 1,
    gap: 2,
  },
  branchName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  branchMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  refBadge: {
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "flex-end",
    minWidth: 88,
  },
  refLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  refValue: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  tableRow: {
    gap: 8,
    paddingRight: 4,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  orderTotal: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyCart: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  emptyCartIcon: {
    fontSize: 28,
  },
  emptyCartText: {
    color: colors.muted,
    fontSize: 14,
  },
  cartList: {
    gap: 8,
  },
  cartLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  cartLineCopy: {
    flex: 1,
    gap: 4,
  },
  cartLineName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  cartLinePrice: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  notesWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  notesInput: {
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    padding: 14,
    minHeight: 80,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionHalf: {
    flex: 1,
  },
  menuCard: {
    gap: 12,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: colors.muted,
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
  },
  categoryRow: {
    gap: 8,
    paddingRight: 4,
  },
  menuLoading: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  menuSection: {
    gap: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  menuItemPressed: {
    opacity: 0.85,
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  menuItemCopy: {
    flex: 1,
    gap: 4,
  },
  menuItemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  menuItemPrice: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnActive: {
    backgroundColor: colors.accent,
    borderColor: "#d97706",
  },
  addBtnText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 22,
  },
  addBtnTextActive: {
    color: colors.accentText,
    fontSize: 15,
    fontWeight: "700",
  },
  kitchenEmpty: {
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  kitchenEmptyText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  kitchenTicket: {
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  kitchenTicketTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  kitchenRef: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  kitchenMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  kitchenItems: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  billCard: {
    gap: 14,
  },
  billBreakdown: {
    gap: 8,
    paddingBottom: 4,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  billValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  billTotalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  billTotalLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  billTotalValue: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  footerLink: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  footerText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderRadius: 12,
    padding: 14,
  },
  editBannerCopy: {
    flex: 1,
    gap: 2,
  },
  editBannerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  editBannerHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  editCancelBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0b1220",
  },
  editCancelText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  kitchenTicketEditing: {
    borderColor: "rgba(245, 158, 11, 0.45)",
  },
  editOrderBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editOrderBtnText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  editingLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  deliveryInput: {
    marginBottom: 10,
  },
});
