import {
  formatMenuItemLabel,
  menuItemDisplayPrice,
  type Bill,
  type KitchenTicket,
  type MenuItem,
  type MenuItemVariant,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLiveRefetchInterval } from "../src/hooks/useLiveRefetchInterval";
import { DeliveryMap } from "../src/components/DeliveryMap";
import { DishVariantModal } from "../src/components/DishVariantModal";
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
import { useThemedStyleSheet } from "../src/theme/useThemedStyleSheet";
import { formatPkr, formatTimeAgo, kitchenStatusLabel } from "../src/lib/orderDisplay";
import { matchesTable, newOrderRef, type CartLine, type TableDraft } from "../src/lib/orderDrafts";
import {
  buildCartLine,
  pickDefaultVariant,
  resolveSellableVariants,
  shouldOpenVariantPicker,
} from "../src/lib/cartVariants";
import {
  canEditHeldBill,
  canEditKitchenTicket,
  cartFromBill,
  cartFromKitchenTicket,
  extractKitchenNotes,
  ownsHeldBill,
  ownsKitchenTicket,
  resolveTableKey,
  type EditingOrder,
} from "../src/lib/loadOrder";
import { buildTableOccupancy, occupancyForTable } from "../src/lib/tableStatus";
import { useBranchStore } from "../src/stores/branchStore";
import {
  deliveryNotes,
  inferOrderModeFromStation,
  MOBILE_ORDER_MODES,
  stationLabelForMode,
  type MobileOrderMode,
} from "../src/lib/orderMode";
import { resolveStaffRole, isCashierRole } from "../src/lib/roles";
import { printBillReceipt, printCartBill, printCartOrder, printKitchenOrder } from "../src/lib/printBill";
import { cartToKotBaseline, diffKotLines, type KotBaselineLine } from "../src/lib/kotLineDelta";
import { calcServiceTaxTotals, DEFAULT_POS_TAX_SETTINGS, posTaxSettingsFromApi } from "../src/lib/posTaxSettings";
import { fetchTaxFeatures } from "../src/api/admin";
import { fetchTaxSettings } from "../src/api/accounting";
import { resolveAutoPraMode } from "../src/lib/praIssueFlow";
import { releaseTableAfterBillClose } from "../src/lib/releaseTableAfterClose";
import { useSessionStore } from "../src/stores/sessionStore";

const EMPTY_TAX = DEFAULT_POS_TAX_SETTINGS;

function emptyDraft(orderRef: string): TableDraft {
  return { cart: [], notes: "", orderRef };
}

function kitchenAccent(status: string): string {
  if (status === "ready") return colors.success;
  if (status === "cooking") return "#38bdf8";
  return colors.warning;
}

export default function OrderScreen() {
  const styles = useScreenStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ editTicketId?: string; editBillId?: string }>();
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);

  const branchCode = branch?.code ?? "";
  const [tableId, setTableId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
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
  const [variantPickerItem, setVariantPickerItem] = useState<MenuItem | null>(null);
  const appliedEditRef = useRef<string | null>(null);
  const sendLockRef = useRef(false);
  const billLockRef = useRef(false);
  const printLockRef = useRef(false);
  /** Cart snapshot when edit started — UPDATE KOT prints only the delta. */
  const kotBaselineRef = useRef<KotBaselineLine[] | null>(null);
  const [orderWriteBusy, setOrderWriteBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const kitchenPoll = useLiveRefetchInterval(15_000);
  const ordersPoll = useLiveRefetchInterval(20_000);
  const floorPoll = useLiveRefetchInterval(30_000);

  const floorQuery = useQuery({
    queryKey: ["tables", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchFloor(branchCode),
    refetchInterval: orderWriteBusy ? false : floorPoll,
    staleTime: 20_000,
  });

  const menuQuery = useQuery({
    queryKey: ["menu", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchMenu(branchCode),
    staleTime: 5 * 60_000,
  });

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: orderWriteBusy ? false : kitchenPoll,
    staleTime: 10_000,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchOrders(branchCode),
    refetchInterval: orderWriteBusy ? false : ordersPoll,
    staleTime: 15_000,
  });

  const ridersQuery = useQuery({
    queryKey: ["delivery-riders", branchCode],
    enabled: Boolean(branchCode) && orderMode === "delivery",
    queryFn: () => fetchRiders(branchCode),
  });

  const taxQuery = useQuery({
    queryKey: ["tax-features"],
    queryFn: fetchTaxFeatures,
    staleTime: 60_000,
  });

  const posTaxQuery = useQuery({
    queryKey: ["pos-tax-settings", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchTaxSettings(branchCode!),
    staleTime: 30_000,
  });
  const TAX_SETTINGS = posTaxQuery.data
    ? posTaxSettingsFromApi(posTaxQuery.data)
    : EMPTY_TAX;

  const tables = useMemo(() => {
    return (floorQuery.data?.tables ?? []).filter((t) => t.isActive);
  }, [floorQuery.data]);

  const sections = useMemo(() => {
    const all = (floorQuery.data?.sections ?? [])
      .filter((s) => s.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    // Only show sections that have at least one active table.
    return all.filter((s) => tables.some((t) => t.sectionId === s.id));
  }, [floorQuery.data?.sections, tables]);

  const sectionTables = useMemo(() => {
    if (sections.length === 0) return tables;
    if (!selectedSectionId) return tables;
    return tables
      .filter((t) => t.sectionId === selectedSectionId)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
  }, [tables, sections.length, selectedSectionId]);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  const visibleTables = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return sectionTables;
    return sectionTables.filter(
      (t) =>
        t.tableNumber.toLowerCase().includes(q) ||
        (t.bookedOrderRef ?? "").toLowerCase().includes(q),
    );
  }, [sectionTables, tableSearch]);

  // Keep the selected hall in sync with the active table (edit mode / section switch).
  useEffect(() => {
    if (sections.length === 0) {
      if (selectedSectionId) setSelectedSectionId(null);
      return;
    }
    const fromTable = tables.find((t) => t.tableNumber === tableId)?.sectionId ?? null;
    if (fromTable && sections.some((s) => s.id === fromTable)) {
      if (selectedSectionId !== fromTable) setSelectedSectionId(fromTable);
      return;
    }
    if (!selectedSectionId || !sections.some((s) => s.id === selectedSectionId)) {
      setSelectedSectionId(sections[0]!.id);
    }
  }, [sections, tables, tableId, selectedSectionId]);

  const myUserId = claims?.sub ?? null;

  const tableOccupancy = useMemo(
    () => buildTableOccupancy(kitchenQuery.data ?? [], ordersQuery.data ?? [], myUserId),
    [kitchenQuery.data, ordersQuery.data, myUserId],
  );

  const activeTableId = tableId ?? tables[0]?.tableNumber ?? null;
  const activeTableOccupancy = occupancyForTable(tableOccupancy, activeTableId);
  const activeFloorTable = tables.find((t) => t.tableNumber === activeTableId);
  const activeTableFloorBooked = activeFloorTable?.bookingStatus === "booked";
  const activeTableLockedByOther = Boolean(activeTableOccupancy && !activeTableOccupancy.mine);
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

  function updateDraft(patch: Partial<TableDraft> | ((current: TableDraft) => Partial<TableDraft>)): void {
    if (!draftKey) return;
    setDrafts((prev) => {
      const current = prev[draftKey] ?? emptyDraft(orderRef);
      const patchValue = typeof patch === "function" ? patch(current) : patch;
      return {
        ...prev,
        [draftKey]: { ...current, ...patchValue },
      };
    });
  }

  function combinedOrderNotes(): string | undefined {
    const riderName =
      orderMode === "delivery" && deliveryRiderId
        ? activeRiders.find((r) => r.id === deliveryRiderId)?.name
        : undefined;
    const delivery =
      orderMode === "delivery"
        ? deliveryNotes(deliveryCustomer, deliveryPhone, deliveryAddress, riderName)
        : undefined;
    const kitchen = notes.trim();
    if (delivery && kitchen) return `${delivery} · ${kitchen}`;
    return delivery ?? (kitchen || undefined);
  }

  function validateOrderTarget(): string | null {
    if (orderMode === "dine-in" && !activeTableId) return "Select a table first.";
    if (orderMode === "dine-in" && !editingOrder && activeTableLockedByOther) {
      const owner =
        activeTableOccupancy?.ownerName ??
        activeFloorTable?.bookedOrderRef ??
        "another waiter";
      return `Table ${activeTableId} is booked by ${owner}. You can view the order but not edit it.`;
    }
    if (
      orderMode === "dine-in" &&
      !editingOrder &&
      activeTableFloorBooked &&
      !activeTableOccupancy?.mine
    ) {
      return activeFloorTable?.bookedOrderRef
        ? `Table ${activeTableId} is booked · ${activeFloorTable.bookedOrderRef}. Close or complete that order first.`
        : `Table ${activeTableId} is booked. Close or complete the current order first.`;
    }
    if (orderMode === "delivery") {
      if (activeRiders.length === 0) return "No active riders for this branch. Open the Delivery screen once or create a Rider user.";
      if (!deliveryRiderId) return "Select a rider for this delivery order.";
    }
    return null;
  }

  function cartLines() {
    return cart.map((line) => ({
      label: line.lineLabel || formatMenuItemLabel({
        name: line.item.name,
        portion: line.item.portion,
        variantLabel: line.variant?.label ?? null,
      }),
      qty: line.qty,
      unitPrice: line.unitPrice,
      menuItemId: line.item.id,
      categoryId: line.item.categoryId,
    }));
  }

  function invalidateOrderFeeds(): void {
    void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["tables"] });
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
    kotBaselineRef.current = cartToKotBaseline(loadedCart);
    setDrafts((prev) => ({
      ...prev,
      [tableKey]: {
        cart: loadedCart,
        notes: extractKitchenNotes(ticket),
        orderRef: ticket.orderRef ?? ticket.ticketRef,
      },
    }));
    setShowMenu(true);
    setNotice("Editing order — change items, then update. Kitchen gets UPDATE REVISED with only changed lines.");
  }

  function applyBillEdit(bill: Bill): void {
    const tableKey = resolveTableKey(bill.tableLabel);
    const loadedCart = cartFromBill(menuItems, bill);
    setEditingOrder({ kind: "bill", billId: bill.id });
    setTableId(tableKey);
    kotBaselineRef.current = cartToKotBaseline(loadedCart);
    setDrafts((prev) => ({
      ...prev,
      [tableKey]: {
        cart: loadedCart,
        notes: bill.notes?.trim() ?? "",
        orderRef: bill.orderRef ?? bill.billRef,
      },
    }));
    setShowMenu(true);
    setNotice("Editing held bill — update items, then save. Receipt prints as UPDATE REVISED.");
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

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const deliveryExtra =
    orderMode === "delivery" ? Math.max(0, Number(deliveryCharge) || 0) : 0;
  const totals = calcServiceTaxTotals(subtotal, TAX_SETTINGS, "cash", orderMode);
  const { service, servicePct, tax, taxPct, total: foodTotal, cashTaxPct, cardTaxPct, cashTax, cardTax, cashTotal, cardTotal } =
    totals;
  const total = foodTotal + deliveryExtra;

  const editTicketId = typeof params.editTicketId === "string" ? params.editTicketId : undefined;
  const editBillId = typeof params.editBillId === "string" ? params.editBillId : undefined;

  useEffect(() => {
    if (menuItems.length === 0) return;
    const key = editTicketId ?? editBillId ?? null;
    if (!key || appliedEditRef.current === key) return;

    if (editTicketId) {
      const ticket = kitchenQuery.data?.find((row) => row.id === editTicketId);
      if (ticket && canEditKitchenTicket(ticket)) {
        if (!ownsKitchenTicket(ticket, myUserId)) {
          appliedEditRef.current = key;
          setNotice(
            `This order was taken by ${ticket.createdByName ?? "another waiter"} — view only.`,
          );
          return;
        }
        applyTicketEdit(ticket);
        appliedEditRef.current = key;
      }
      return;
    }

    if (editBillId) {
      const bill = ordersQuery.data?.find((row) => row.id === editBillId);
      if (bill && canEditHeldBill(bill)) {
        if (!ownsHeldBill(bill, myUserId)) {
          appliedEditRef.current = key;
          setNotice(`This bill was taken by ${bill.waiterName} — view only.`);
          return;
        }
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
    onMutate: () => {
      setOrderWriteBusy(true);
    },
    onSuccess: async (ticket) => {
      const wasEdit = editingOrder?.kind === "ticket";
      const baseline = kotBaselineRef.current;
      const deltaLines =
        wasEdit && baseline
          ? diffKotLines(baseline, cart).map((d) => ({
              label: d.label,
              qty: d.qty,
              unitPrice: d.unitPrice,
              menuItemId: d.menuItemId,
              categoryId: d.categoryId,
            }))
          : null;
      updateDraft({ cart: [], notes: "" });
      setEditingOrder(null);
      appliedEditRef.current = null;
      kotBaselineRef.current = null;
      setShowMenu(false);
      invalidateOrderFeeds();
      let printed = false;
      if (wasEdit && deltaLines && deltaLines.length === 0) {
        setNotice("Order updated (no item changes — kitchen not reprinted).");
      } else {
        printed = await printKitchenOrder(branch!.name, branch!.code, ticket, menuItems, {
          isOrderUpdate: wasEdit,
          ...(deltaLines && deltaLines.length > 0 ? { linesOverride: deltaLines } : {}),
        });
        setNotice(
          wasEdit
            ? printed
              ? "Order updated — UPDATE REVISED sent (changed items only)."
              : "Order updated successfully."
            : printed
              ? "Order sent — print request to desktop (Live/IP/Server)."
              : "Order sent to kitchen successfully.",
        );
      }
      if (wasEdit) router.replace("/order");
    },
    onError: (err: Error) => setNotice(err.message),
    onSettled: () => {
      sendLockRef.current = false;
      setOrderWriteBusy(false);
    },
  });

  function submitSendOrder(): void {
    if (sendLockRef.current || sendMutation.isPending) return;
    if (cart.length === 0) {
      setNotice("Add at least one item before sending.");
      return;
    }
    const targetErr = validateOrderTarget();
    if (targetErr) {
      setNotice(targetErr);
      return;
    }
    sendLockRef.current = true;
    // Safety unlock if a hung request never settles (seen on flaky mobile networks).
    setTimeout(() => {
      sendLockRef.current = false;
    }, 95_000);
    sendMutation.mutate();
  }

  const billMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Add at least one item.");
      const targetErr = validateOrderTarget();
      if (targetErr) throw new Error(targetErr);
      const lines = cartLines();
      const tableLabel = stationLabelForMode(orderMode, activeTableId);
      const payloadNotes = combinedOrderNotes();
      const billSubtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
      const billTotals = calcServiceTaxTotals(billSubtotal, TAX_SETTINGS, "cash", orderMode);
      const billDelivery =
        orderMode === "delivery" ? Math.max(0, Number(deliveryCharge) || 0) : 0;
      const billTotal = billTotals.total + billDelivery;
      if (editingOrder?.kind === "bill") {
        return updateBill(editingOrder.billId, {
          tableLabel,
          lines,
          notes: payloadNotes ?? null,
          servicePct: billTotals.servicePct,
          taxPct: billTotals.taxPct,
          riderId: orderMode === "delivery" ? deliveryRiderId || null : null,
          deliveryChargePkr: orderMode === "delivery" ? billDelivery : 0,
        });
      }
      const bill = await createBill({
        branchCode,
        orderRef,
        tableLabel,
        waiterId: claims?.sub,
        lines,
        notes: payloadNotes,
        servicePct: billTotals.servicePct,
        taxPct: billTotals.taxPct,
        status: isCashierRole(claims) ? "completed" : "held",
        ...(isCashierRole(claims)
          ? { payments: [{ method: "cash" as const, amount: billTotal }] }
          : {}),
        riderId: orderMode === "delivery" ? deliveryRiderId || undefined : undefined,
        deliveryChargePkr: orderMode === "delivery" ? billDelivery : undefined,
      });
      // Do not mark kitchen ticket done from waiter app — close only via cashier/POS payment.
      return bill;
    },
    onMutate: () => {
      setOrderWriteBusy(true);
    },
    onSuccess: async (bill) => {
      const wasEdit = editingOrder?.kind === "bill";
      updateDraft({ cart: [], notes: "" });
      setEditingOrder(null);
      appliedEditRef.current = null;
      const completed = bill.status === "completed";
      if (completed && branchCode) {
        await releaseTableAfterBillClose(branchCode, bill);
      }
      invalidateOrderFeeds();
      const held = bill.status === "held";
      let message = wasEdit
        ? `Held bill ${bill.billRef} updated.`
        : held
          ? `Bill ${bill.billRef} saved on hold — cashier can close it.`
          : `Bill ${bill.billRef} created and paid — table freed.`;
      if (branch) {
        const praOn = Boolean(
          resolveAutoPraMode({
            praFakeEnabled: taxQuery.data?.praFakeEnabled,
            praRealEnabled: taxQuery.data?.praRealEnabled,
          }),
        );
        // Cashier pay/create: Close semantics (PRA when Active). Held save: simple slip.
        // Held bill edit: UPDATE REVISED banner like POS revised receipt.
        const printed = await printBillReceipt(branch.name, branch.code, bill, {
          embedPra: completed && praOn,
          isOrderUpdate: wasEdit,
        });
        if (printed) {
          message = wasEdit
            ? `${message} UPDATE REVISED receipt sent.`
            : `${message} Receipt sent to printer.`;
        }
      }
      setNotice(message);
      if (wasEdit) router.replace("/order");
    },
    onError: (err: Error) => setNotice(err.message),
    onSettled: () => {
      billLockRef.current = false;
      setOrderWriteBusy(false);
    },
  });

  function submitBill(): void {
    if (billLockRef.current || billMutation.isPending) return;
    if (cart.length === 0) {
      setNotice("Add at least one item before saving the bill.");
      return;
    }
    const targetErr = validateOrderTarget();
    if (targetErr) {
      setNotice(targetErr);
      return;
    }
    billLockRef.current = true;
    setTimeout(() => {
      billLockRef.current = false;
    }, 95_000);
    billMutation.mutate();
  }

  function addVariantToCart(item: MenuItem, variant: MenuItemVariant | null): void {
    const built = buildCartLine(item, variant, 1, 0);
    updateDraft((current) => {
      const next = [...current.cart];
      const i = next.findIndex((l) => l.key === built.key);
      if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + 1 };
      else next.push(built);
      return { cart: next };
    });
    setSearch("");
    setNotice(null);
  }

  function onDishClick(item: MenuItem): void {
    if (shouldOpenVariantPicker(item)) {
      setVariantPickerItem(item);
      return;
    }
    addVariantToCart(item, pickDefaultVariant(item));
  }

  function setLineQty(lineKey: string, qty: number): void {
    let blocked = false;
    let floor = 0;
    updateDraft((current) => {
      const line = current.cart.find((l) => l.key === lineKey);
      if (!line) return current;
      floor = Math.max(0, line.printedQty ?? 0);
      if (qty < floor) blocked = true;
      const nextQty = Math.max(floor, qty);
      if (nextQty <= 0 && floor <= 0) {
        return { cart: current.cart.filter((l) => l.key !== lineKey) };
      }
      return {
        cart: current.cart.map((l) => (l.key === lineKey ? { ...l, qty: nextQty } : l)),
      };
    });
    if (blocked) {
      setNotice(`Cannot reduce below printed qty (${floor}). Increase is allowed.`);
    }
  }

  function markCartPrinted(): void {
    updateDraft((current) => ({
      cart: current.cart.map((l) => ({
        ...l,
        printedQty: Math.max(l.printedQty ?? 0, l.qty),
      })),
    }));
  }

  /** Changed lines for UPDATE REVISED KOT while editing a kitchen ticket. */
  function editKotDeltaLines(): Array<{
    label: string;
    qty: number;
    unitPrice: number;
    menuItemId?: string;
    categoryId?: string;
  }> | null {
    if (editingOrder?.kind !== "ticket" || !kotBaselineRef.current) return null;
    return diffKotLines(kotBaselineRef.current, cart).map((d) => ({
      label: d.label,
      qty: d.qty,
      unitPrice: d.unitPrice,
      menuItemId: d.menuItemId,
      categoryId: d.categoryId,
    }));
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
      // Takeaway / delivery / etc. — jump straight into menu (no Browse menu tap).
      setShowMenu(true);
    }
  }

  function selectSection(sectionId: string): void {
    if (editingOrder) return;
    setSelectedSectionId(sectionId);
    setTableSearch("");
    setNotice(null);
    // Keep current table if it belongs to this section; otherwise pick first free table.
    const inSection = tables.filter((t) => t.sectionId === sectionId);
    if (tableId && inSection.some((t) => t.tableNumber === tableId)) {
      setShowMenu(true);
      return;
    }
    const firstFree = inSection.find((t) => t.bookingStatus !== "booked");
    const next = firstFree?.tableNumber ?? inSection[0]?.tableNumber ?? null;
    if (next) selectTable(next);
    else {
      setTableId(null);
      setShowMenu(false);
    }
  }

  function selectTable(tableNumber: string): void {
    if (editingOrder) return;
    setTableId(tableNumber);
    const floorTable = tables.find((t) => t.tableNumber === tableNumber);
    if (floorTable?.sectionId) {
      setSelectedSectionId(floorTable.sectionId);
    }
    if (!drafts[tableNumber]) {
      setDrafts((prev) => ({
        ...prev,
        [tableNumber]: emptyDraft(newOrderRef()),
      }));
    }
    const occ = occupancyForTable(tableOccupancy, tableNumber);
    const booked = floorTable?.bookingStatus === "booked" || Boolean(occ);
    const lockedByOther = Boolean(occ && !occ.mine);
    // Open menu automatically so staff can order without tapping Browse menu.
    setShowMenu(!lockedByOther);
    if (!booked) {
      setNotice(`Table ${tableNumber} is free.`);
      return;
    }
    if (occ?.mine) {
      setNotice(`Table ${tableNumber} is booked — your order.`);
      return;
    }
    const who =
      occ?.ownerName ?? floorTable?.bookedOrderRef ?? null;
    setNotice(
      who
        ? `Table ${tableNumber} is booked · ${who}.`
        : `Table ${tableNumber} is booked.`,
    );
  }

  function startEditTicket(ticket: KitchenTicket): void {
    if (!canEditKitchenTicket(ticket) || !ownsKitchenTicket(ticket, myUserId)) return;
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
            <View style={styles.tablePicker}>
              {sections.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tableRow}
                >
                  {sections.map((section) => {
                    const count = tables.filter((t) => t.sectionId === section.id).length;
                    return (
                      <Chip
                        key={section.id}
                        label={section.name}
                        selected={selectedSectionId === section.id}
                        sublabel={`${count} table${count === 1 ? "" : "s"}`}
                        disabled={Boolean(editingOrder)}
                        onPress={() => selectSection(section.id)}
                      />
                    );
                  })}
                </ScrollView>
              ) : null}
              {sections.length > 0 || sectionTables.length > 8 ? (
                <Input
                  placeholder={
                    selectedSection
                      ? `Search tables in ${selectedSection.name}…`
                      : "Search table number…"
                  }
                  value={tableSearch}
                  onChangeText={setTableSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!editingOrder}
                />
              ) : null}
              {sections.length > 0 && sectionTables.length === 0 ? (
                <EmptyState
                  title="No tables"
                  message="No tables in this section."
                />
              ) : visibleTables.length === 0 ? (
                <EmptyState
                  title="No matches"
                  message={
                    tableSearch.trim()
                      ? `No tables match “${tableSearch.trim()}”.`
                      : "No tables available."
                  }
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tableRow}
                >
                  {visibleTables.map((t) => {
                    const occ = occupancyForTable(tableOccupancy, t.tableNumber);
                    const floorBooked = t.bookingStatus === "booked";
                    const isBooked = floorBooked || Boolean(occ);
                    const lockedByOther = Boolean(occ && !occ.mine);
                    return (
                      <Chip
                        key={t.id}
                        label={t.tableNumber}
                        selected={activeTableId === t.tableNumber}
                        tone={isBooked ? (occ?.mine ? "mine" : "locked") : undefined}
                        sublabel={
                          isBooked
                            ? occ?.mine
                              ? "Your order"
                              : t.bookedOrderRef
                                ? `Booked · ${t.bookedOrderRef}`
                                : occ?.ownerName ?? "Booked"
                            : "Free"
                        }
                        disabled={lockedByOther || Boolean(editingOrder)}
                        onPress={() => selectTable(t.tableNumber)}
                      />
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
          {activeTableLockedByOther && !editingOrder ? (
            <Text style={styles.lockedTableHint}>
              Table {activeTableId} is booked by{" "}
              {activeTableOccupancy?.ownerName ??
                activeFloorTable?.bookedOrderRef ??
                "another waiter"}
              . You can view the order below, but only they can edit it. The table frees up when
              the order is done.
            </Text>
          ) : activeTableFloorBooked && !activeTableOccupancy?.mine && !editingOrder ? (
            <Text style={styles.lockedTableHint}>
              Table {activeTableId} is booked
              {activeFloorTable?.bookedOrderRef
                ? ` · ${activeFloorTable.bookedOrderRef}`
                : ""}
              . Close or complete that order before starting a new one.
            </Text>
          ) : null}
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
            {deliveryAddress.trim().length >= 4 ? (
              <DeliveryMap address={deliveryAddress} title="Google Maps preview" height={200} />
            ) : null}
            {ridersQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : activeRiders.length === 0 ? (
              <Muted>
                No active riders for this branch yet. Open Delivery on desktop once (or create a Rider user) — they will appear here automatically.
              </Muted>
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
                <View key={line.key} style={styles.cartLine}>
                  <View style={styles.cartLineCopy}>
                    <Text style={styles.cartLineName} numberOfLines={2}>
                      {line.lineLabel}
                    </Text>
                    <Text style={styles.cartLinePrice}>
                      {formatPkr(line.unitPrice * line.qty)}
                    </Text>
                  </View>
                  <QtyStepper
                    qty={line.qty}
                    minQty={line.printedQty ?? 0}
                    onDecrement={() => setLineQty(line.key, line.qty - 1)}
                    onIncrement={() => setLineQty(line.key, line.qty + 1)}
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
                      ? "Update & print"
                      : "Send & print"
                }
                onPress={submitSendOrder}
                disabled={cart.length === 0 || Boolean(validateOrderTarget()) || sendMutation.isPending}
                loading={sendMutation.isPending}
              />
            </View>
            ) : null}
          </View>

          {cart.length > 0 ? (
            <View style={styles.printRow}>
              {editingOrder?.kind !== "bill" ? (
                <View style={styles.actionHalf}>
                  <Button
                    label={
                      printBusy
                        ? "Printing…"
                        : editingOrder?.kind === "ticket"
                          ? "Print UPDATE"
                          : "Print order"
                    }
                    variant="ghost"
                    disabled={Boolean(validateOrderTarget()) || printBusy}
                    onPress={() => {
                      if (printLockRef.current || printBusy) return;
                      printLockRef.current = true;
                      setPrintBusy(true);
                      void (async () => {
                        try {
                          const isTicketEdit = editingOrder?.kind === "ticket";
                          const deltaLines = isTicketEdit ? editKotDeltaLines() : null;
                          if (isTicketEdit && deltaLines && deltaLines.length === 0) {
                            setNotice("No item changes — kitchen not reprinted.");
                            return;
                          }
                          const ok = await printCartOrder({
                            branchName: branch.name,
                            branchCode: branch.code,
                            orderRef,
                            stationLabel: stationLabelForMode(orderMode, activeTableId),
                            waiterName: waiterEmail,
                            notes: combinedOrderNotes() ?? null,
                            lines:
                              deltaLines && deltaLines.length > 0
                                ? deltaLines
                                : cartLines(),
                            total,
                            isOrderUpdate: isTicketEdit,
                          });
                          if (ok) markCartPrinted();
                          setNotice(
                            ok
                              ? isTicketEdit
                                ? "UPDATE REVISED sent (changed items only)."
                                : "Print order sent. Printed qty is locked — you can only increase."
                              : "Could not print order.",
                          );
                        } finally {
                          printLockRef.current = false;
                          setPrintBusy(false);
                        }
                      })();
                    }}
                  />
                </View>
              ) : null}
              <View style={editingOrder?.kind !== "bill" ? styles.actionHalf : undefined}>
                <Button
                  label={
                    printBusy
                      ? "Printing…"
                      : editingOrder
                        ? "Print UPDATE bill"
                        : "Print bill"
                  }
                  disabled={Boolean(validateOrderTarget()) || printBusy}
                  onPress={() => {
                    if (printLockRef.current || printBusy) return;
                    printLockRef.current = true;
                    setPrintBusy(true);
                    void (async () => {
                      try {
                        const ok = await printCartBill({
                          branchName: branch.name,
                          branchCode: branch.code,
                          orderRef,
                          tableLabel: stationLabelForMode(orderMode, activeTableId),
                          waiterName: waiterEmail,
                          lines: cartLines().map((l) => ({
                            label: l.label,
                            qty: l.qty,
                            unitPrice: l.unitPrice ?? 0,
                          })),
                          subtotal,
                          service,
                          servicePct,
                          tax,
                          taxPct,
                          total,
                          deliveryChargePkr:
                            orderMode === "delivery" ? Math.max(0, Number(deliveryCharge) || 0) : 0,
                          cashTaxPct,
                          cardTaxPct,
                          cashTax,
                          cardTax,
                          cashTotal: cashTotal + deliveryExtra,
                          cardTotal: cardTotal + deliveryExtra,
                          isOrderUpdate: Boolean(editingOrder),
                        });
                        setNotice(
                          ok
                            ? editingOrder
                              ? "UPDATE REVISED bill sent to printer."
                              : "Bill sent to printer."
                            : "Could not print bill.",
                        );
                      } finally {
                        printLockRef.current = false;
                        setPrintBusy(false);
                      }
                    })();
                  }}
                />
              </View>
            </View>
          ) : null}
        </Card>

        {showMenu ? (
          <Card style={styles.menuCard}>
            <SectionHeader title="Menu" actionLabel="Close" onAction={() => setShowMenu(false)} />

            {cartQty > 0 ? (
              <View style={styles.menuCartSummary}>
                <Text style={styles.menuCartSummaryText}>
                  Qty {cartQty} · {cart.length} item{cart.length === 1 ? "" : "s"}
                </Text>
                <Text style={styles.menuCartSummaryTotal}>{formatPkr(subtotal)}</Text>
              </View>
            ) : null}

            <View style={styles.searchWrap}>
              <Text style={styles.searchIcon}>⌕</Text>
              <Input
                placeholder="Search dishes or categories…"
                placeholderTextColor={colors.muted}
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
                  const itemLines = cart.filter((l) => l.item.id === item.id);
                  const inCart = itemLines.reduce((s, l) => s + l.qty, 0);
                  const variants = resolveSellableVariants(item);
                  const displayPrice = menuItemDisplayPrice(item);
                  const primaryLine = itemLines.length === 1 ? itemLines[0] : null;
                  return (
                    <View key={item.id} style={styles.menuItem}>
                      <Pressable
                        onPress={() => {
                          if (inCart === 0 || shouldOpenVariantPicker(item)) onDishClick(item);
                        }}
                        style={({ pressed }) => [
                          styles.menuItemCopy,
                          pressed && styles.menuItemPressed,
                        ]}
                      >
                        <Text style={styles.menuItemName} numberOfLines={2}>
                          {formatMenuItemLabel(item)}
                          {variants.length > 1 ? " · sizes" : ""}
                        </Text>
                        <Text style={styles.menuItemPrice}>
                          {variants.length > 1 ? `From ${formatPkr(displayPrice)}` : formatPkr(displayPrice)}
                        </Text>
                      </Pressable>
                      {primaryLine ? (
                        <QtyStepper
                          qty={primaryLine.qty}
                          minQty={primaryLine.printedQty ?? 0}
                          onDecrement={() => setLineQty(primaryLine.key, primaryLine.qty - 1)}
                          onIncrement={() => setLineQty(primaryLine.key, primaryLine.qty + 1)}
                        />
                      ) : inCart > 0 ? (
                        <Pressable
                          onPress={() => onDishClick(item)}
                          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
                          hitSlop={8}
                        >
                          <Text style={styles.addBtnText}>+</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => onDishClick(item)}
                          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
                          hitSlop={8}
                        >
                          <Text style={styles.addBtnText}>+</Text>
                        </Pressable>
                      )}
                    </View>
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
              const isMine = ownsKitchenTicket(k, myUserId);
              const canEdit = canEditKitchenTicket(k) && isMine;
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
                      {k.createdByName ? ` · by ${k.createdByName}` : ""}
                    </Text>
                  </View>
                  <StatusBadge status={kitchenStatusLabel(k.status)} />
                </View>
                <Text style={styles.kitchenItems} numberOfLines={2}>
                  {k.itemsSummary}
                </Text>
                <View style={styles.kitchenActions}>
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        const lines = (k.lines ?? []).map((line) => ({
                          label: line.label,
                          qty: line.qty,
                          unitPrice: line.unitPrice ?? 0,
                        }));
                        const kotSubtotal = lines.reduce(
                          (sum, line) => sum + line.unitPrice * line.qty,
                          0,
                        );
                        const kotTotals = calcServiceTaxTotals(
                          kotSubtotal,
                          TAX_SETTINGS,
                          "cash",
                          orderMode,
                        );
                        const ok = await printCartBill({
                          branchName: branch.name,
                          branchCode: branch.code,
                          orderRef: k.orderRef ?? k.ticketRef,
                          tableLabel: k.stationLabel,
                          waiterName: k.createdByName ?? waiterEmail,
                          lines:
                            lines.length > 0
                              ? lines
                              : [{ label: k.itemsSummary || "Order", qty: 1, unitPrice: kotSubtotal }],
                          subtotal: kotSubtotal,
                          service: kotTotals.service,
                          servicePct: kotTotals.servicePct,
                          tax: kotTotals.tax,
                          taxPct: kotTotals.taxPct,
                          total: kotTotals.total,
                          cashTaxPct: kotTotals.cashTaxPct,
                          cardTaxPct: kotTotals.cardTaxPct,
                          cashTax: kotTotals.cashTax,
                          cardTax: kotTotals.cardTax,
                          cashTotal: kotTotals.cashTotal,
                          cardTotal: kotTotals.cardTotal,
                        });
                        setNotice(
                          ok
                            ? `Bill sent for ${k.orderRef ?? k.ticketRef}.`
                            : "Could not print bill.",
                        );
                      })();
                    }}
                    style={styles.printBillBtn}
                  >
                    <Text style={styles.printBillBtnText}>Print bill</Text>
                  </Pressable>
                  {canEdit && !editingOrder ? (
                    <Pressable onPress={() => startEditTicket(k)} style={styles.editOrderBtn}>
                      <Text style={styles.editOrderBtnText}>Edit order</Text>
                    </Pressable>
                  ) : null}
                </View>
                {!isMine ? (
                  <Text style={styles.viewOnlyLabel}>
                    Taken by {k.createdByName ?? "another waiter"} — view only
                  </Text>
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
                <Text style={styles.billLabel}>Service ({servicePct}%)</Text>
                <Text style={styles.billValue}>{formatPkr(service)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Sales Tax cash ({cashTaxPct}%)</Text>
                <Text style={styles.billValue}>{formatPkr(cashTax)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Sales Tax card ({cardTaxPct}%)</Text>
                <Text style={styles.billValue}>{formatPkr(cardTax)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Total (cash)</Text>
                <Text style={styles.billValue}>{formatPkr(cashTotal + deliveryExtra)}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Total (card)</Text>
                <Text style={styles.billValue}>{formatPkr(cardTotal + deliveryExtra)}</Text>
              </View>
              <View style={[styles.billRow, styles.billTotalRow]}>
                <Text style={styles.billTotalLabel}>Preview total</Text>
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
                    ? isCashierRole(claims)
                      ? `Create & print · ${formatPkr(total)}`
                      : `Save bill (hold) · ${formatPkr(total)}`
                    : "Create bill"
            }
            onPress={submitBill}
            disabled={cart.length === 0 || Boolean(validateOrderTarget()) || billMutation.isPending}
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
      {variantPickerItem ? (
        <DishVariantModal
          item={variantPickerItem}
          variants={resolveSellableVariants(variantPickerItem)}
          onClose={() => setVariantPickerItem(null)}
          onSelect={(variant) => {
            addVariantToCart(variantPickerItem, variant);
            setVariantPickerItem(null);
          }}
        />
      ) : null}
    </Screen>
  );
}


function useScreenStyles() {
  return useThemedStyleSheet((c) => ({

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
    color: c.text,
    fontSize: 18,
    fontWeight: "700",
  },
  branchMeta: {
    color: c.muted,
    fontSize: 13,
  },
  refBadge: {
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "flex-end",
    minWidth: 88,
  },
  refLabel: {
    color: c.muted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  refValue: {
    color: c.accent,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: "700",
  },
  sectionHint: {
    color: c.muted,
    fontSize: 13,
    marginTop: 2,
  },
  tablePicker: {
    gap: 10,
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
    color: c.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  emptyCart: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
    backgroundColor: c.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: "dashed",
  },
  emptyCartIcon: {
    fontSize: 28,
  },
  emptyCartText: {
    color: c.muted,
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
    backgroundColor: c.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
  },
  cartLineCopy: {
    flex: 1,
    gap: 4,
  },
  cartLineName: {
    color: c.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  cartLinePrice: {
    color: c.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  notesWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  notesInput: {
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    color: c.text,
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
  printRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionHalf: {
    flex: 1,
  },
  menuCard: {
    gap: 12,
    borderColor: "rgba(15, 118, 110, 0.25)",
  },
  menuCartSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.35)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuCartSummaryText: {
    color: c.text,
    fontSize: 13,
    fontWeight: "600",
  },
  menuCartSummaryTotal: {
    color: c.accent,
    fontSize: 16,
    fontWeight: "800",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    color: c.muted,
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    color: c.text,
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
    backgroundColor: c.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuItemPressed: {
    opacity: 0.9,
    borderColor: "rgba(15, 118, 110, 0.55)",
    backgroundColor: "rgba(15, 118, 110, 0.08)",
  },
  menuItemCopy: {
    flex: 1,
    gap: 4,
  },
  menuItemName: {
    color: c.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  menuItemPrice: {
    color: c.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: {
    color: c.text,
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 24,
  },
  addBtnActive: {
    backgroundColor: c.accent,
    borderColor: "#14B8A6",
  },
  addBtnTextActive: {
    color: c.accentText,
    fontSize: 15,
    fontWeight: "700",
  },
  kitchenEmpty: {
    backgroundColor: c.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
  },
  kitchenEmptyText: {
    color: c.muted,
    fontSize: 14,
    textAlign: "center",
  },
  kitchenTicket: {
    backgroundColor: c.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.text,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  kitchenMeta: {
    color: c.muted,
    fontSize: 12,
    marginTop: 2,
  },
  kitchenItems: {
    color: c.muted,
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
    color: c.muted,
    fontSize: 14,
  },
  billValue: {
    color: c.text,
    fontSize: 14,
    fontWeight: "500",
  },
  billTotalRow: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  billTotalLabel: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
  },
  billTotalValue: {
    color: c.accent,
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
    color: c.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.35)",
    borderRadius: 12,
    padding: 14,
  },
  editBannerCopy: {
    flex: 1,
    gap: 2,
  },
  editBannerTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: "700",
  },
  editBannerHint: {
    color: c.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  editCancelBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.bg,
  },
  editCancelText: {
    color: c.text,
    fontSize: 13,
    fontWeight: "600",
  },
  kitchenTicketEditing: {
    borderColor: "rgba(15, 118, 110, 0.45)",
  },
  kitchenActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  printBillBtn: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.45)",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  printBillBtnText: {
    color: c.success,
    fontSize: 13,
    fontWeight: "700",
  },
  editOrderBtn: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.45)",
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editOrderBtnText: {
    color: c.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  editingLabel: {
    color: c.accent,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  viewOnlyLabel: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  lockedTableHint: {
    color: "#f87171",
    fontSize: 12,
    lineHeight: 17,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    borderRadius: 10,
    padding: 10,
  },
  deliveryInput: {
    marginBottom: 10,
  },

  }));
}

