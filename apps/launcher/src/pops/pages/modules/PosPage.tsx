import {
  formatMenuItemLabel,
  menuItemDisplayPrice,
  type Bill,
  type KitchenTicket,
  type MenuItem as ApiMenuItem,
  type MenuItemVariant,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchCompletedOrders, createBill, completeBill, updateBill } from "../../api/billing";
import { fetchOpenCashSession } from "../../api/accounting";
import { fetchRiders } from "../../api/delivery";
import { createKitchenTicket, fetchKitchenTickets, updateKitchenTicket } from "../../api/kitchen";
import { fetchBranchMenu } from "../../api/menu";
import { fetchBranchFloor } from "../../api/tables";
import { PosDishVariantModal } from "../../components/PosDishVariantModal";
import { PosLatestOrdersPanel } from "../../components/PosLatestOrdersPanel";
import { PosSeatingModal } from "../../components/PosSeatingModal";
import {
  POS_ORDER_MODES,
  posBillTableLabel,
  posDeliveryNotes,
  posOrderModeLabel,
  posPrintTableLabel,
  posStationLabel,
  type PosOrderMode,
} from "../../lib/posOrderMode";
import {
  buildCartLine,
  pickDefaultVariant,
  resolvePosSellableVariants,
  shouldOpenVariantPicker,
  type PosCartLine,
} from "../../lib/posCart";
import { printReceipt, printKot, type PrintTicketInput } from "../../lib/printTicket";
import { resolveMenuImageUrl } from "../../lib/menuImageUrl";
import { buildPosRecentOrders, canChangePosRecentOrderTable, canPayPosRecentOrder, type PosRecentOrder } from "../../lib/recentOrders";
import {
  cartFromBill,
  cartFromKitchenTicket,
  inferPosModeFromStation,
  parseDeliveryFieldsFromNotes,
  tableNumberFromStation,
} from "../../lib/posLoadOrder";
import {
  clampDiscountPkr,
  computeTicketTotals,
  discountAmountFromPct,
  discountPctFromAmount,
} from "../../lib/posDiscount";
import { PosCheckoutModal, type CheckoutModalMode } from "../../components/PosCheckoutModal";
import { PosSplitBillModal, type SplitBillPart } from "../../components/PosSplitBillModal";
import { ChangeOrderTableModal, type ChangeTableTicket } from "../../components/ChangeOrderTableModal";
import { PosPayOutModal } from "../../components/PosPayOutModal";
import { PosCashierModal, type PosCashierMode } from "../../components/PosCashierModal";
import { PosTableTransferPickerModal } from "../../components/PosTableTransferPickerModal";
import { cartToBillLines } from "../../lib/posCheckout";
import { amberPillActiveClass, fieldInputClass, pillInactiveClass } from "../../lib/themeClasses";
import {
  DELIVERY_SETTINGS_CHANGED_EVENT,
  loadDeliverySettings,
  type DeliverySettings,
} from "../../lib/deliverySettings";
import {
  loadPosSettings,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../../lib/posSettings";
import { buildMenuItemOrderCounts, sortMenuByPopularity } from "../../lib/posMenuPopularity";
import { nextOrderRef, peekNextOrderRef } from "../../lib/orderNumber";
import {
  DEFAULT_HAPPY_HOUR_SETTINGS,
  formatHappyHourSlotSummary,
  HAPPY_HOUR_SETTINGS_CHANGED_EVENT,
  loadHappyHourSettings,
  type HappyHourSettings,
} from "../../lib/happyHourSettings";
import {
  applyHappyHourBonus,
  applyHappyHourDiscountPrice,
  getActiveHappyHourSlot,
  isHappyHourActive,
  resolveHappyHourBonusItem,
  stripComplimentaryLines,
} from "../../lib/posHappyHour";

const TICKET_INPUT_CLASS = `${fieldInputClass} w-full min-w-0 text-xs`;
const TICKET_NUMBER_INPUT_CLASS = `${fieldInputClass} w-full min-w-0 py-1.5 text-right text-xs`;

const POS_ACTION_BTN =
  "inline-flex w-full min-w-0 items-center justify-center rounded-lg px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const POS_PRIMARY_ORDER_BTN = `${POS_ACTION_BTN} h-10 border-0 bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400`;
const POS_PRIMARY_PAY_BTN = `${POS_ACTION_BTN} h-10 border-0 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500`;
const POS_SECONDARY_BTN = `${POS_ACTION_BTN} h-9 border border-slate-200 bg-white font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white`;
const POS_TOOLBAR_BTN =
  "inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1.5 text-[10px] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white";
const POS_MODE_BAR =
  "flex shrink-0 rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200 dark:bg-slate-950/80 dark:ring-slate-800/80";
const POS_MODE_BTN = (active: boolean) =>
  `flex-1 rounded-md px-2 py-2 text-xs font-semibold transition ${
    active
      ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20"
      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
  }`;

type PosEditingOrder =
  | { kind: "ticket"; ticketId: string }
  | { kind: "held-bill"; billId: string }
  | null;

type PosEditLocationState = {
  editTicketId?: string;
  editBillId?: string;
};

export function PosPage(): JSX.Element {
  const queryClient = useQueryClient();
  const location = useLocation();
  const branch = usePopsStore((s) => s.branch);
  const [mode, setMode] = useState<PosOrderMode>("dine-in");
  const [deliveryCustomer, setDeliveryCustomer] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryRiderId, setDeliveryRiderId] = useState("");
  const [deliveryChargePkr, setDeliveryChargePkr] = useState(0);
  const [deliveryDetailsOpen, setDeliveryDetailsOpen] = useState(false);
  const [selectedFloorSectionId, setSelectedFloorSectionId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [menuView, setMenuView] = useState<"all" | "category" | "featured">("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [variantPickerItem, setVariantPickerItem] = useState<ApiMenuItem | null>(null);
  const [discountPctInput, setDiscountPctInput] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountEditedAs, setDiscountEditedAs] = useState<"pct" | "amount">("pct");
  const [posSettings, setPosSettings] = useState<PosSettings>(() => loadPosSettings(undefined));
  const [happyHourSettings, setHappyHourSettings] = useState<HappyHourSettings>(
    () => DEFAULT_HAPPY_HOUR_SETTINGS,
  );
  const [orderRef, setOrderRef] = useState(() => peekNextOrderRef(undefined));
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalMode | null>(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [ticketServicePct, setTicketServicePct] = useState(10);
  const [seatingModalOpen, setSeatingModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PosEditingOrder>(null);
  const [tableTransferTicket, setTableTransferTicket] = useState<ChangeTableTicket | null>(null);
  const [tableTransferPickerOpen, setTableTransferPickerOpen] = useState(false);
  const [payOutModalOpen, setPayOutModalOpen] = useState(false);
  const [cashierModal, setCashierModal] = useState<PosCashierMode | null>(null);
  const cashierPromptShown = useRef(false);
  const seatingAutoOpened = useRef(false);
  const pendingEditRef = useRef<PosEditLocationState | null>(
    (location.state as PosEditLocationState | null) ?? null,
  );

  const menuQuery = useQuery({
    queryKey: ["menu", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchMenu(branch!.code),
  });

  useEffect(() => {
    setPosSettings(loadPosSettings(branch?.code));
    setHappyHourSettings(loadHappyHourSettings(branch?.code));
  }, [branch?.code]);

  useEffect(() => {
    function onHappyHourChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setHappyHourSettings(loadHappyHourSettings(branch?.code));
      }
    }
    window.addEventListener(HAPPY_HOUR_SETTINGS_CHANGED_EVENT, onHappyHourChanged);
    return () => window.removeEventListener(HAPPY_HOUR_SETTINGS_CHANGED_EVENT, onHappyHourChanged);
  }, [branch?.code]);

  useEffect(() => {
    if (!editingOrder) setOrderRef(peekNextOrderRef(branch?.code));
  }, [branch?.code, editingOrder]);

  useEffect(() => {
    function onPosSettingsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setPosSettings(loadPosSettings(branch?.code));
      }
    }
    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
    return () => window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
  }, [branch?.code]);

  const { servicePct: defaultServicePct, taxPct } = posSettings;

  useEffect(() => {
    setTicketServicePct(defaultServicePct);
  }, [defaultServicePct]);

  useEffect(() => {
    function applyDeliveryDefaults(settings: DeliverySettings): void {
      setDeliveryChargePkr(settings.defaultChargePkr);
    }
    applyDeliveryDefaults(loadDeliverySettings(branch?.code));
    function onDeliverySettingsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        applyDeliveryDefaults(loadDeliverySettings(branch?.code));
      }
    }
    window.addEventListener(DELIVERY_SETTINGS_CHANGED_EVENT, onDeliverySettingsChanged);
    return () => window.removeEventListener(DELIVERY_SETTINGS_CHANGED_EVENT, onDeliverySettingsChanged);
  }, [branch?.code]);

  const ridersQuery = useQuery({
    queryKey: ["delivery-riders", branch?.code],
    enabled: Boolean(branch?.code) && mode === "delivery",
    queryFn: () => fetchRiders(branch!.code),
  });

  const activeRiders = useMemo(
    () => (ridersQuery.data ?? []).filter((r) => r.active),
    [ridersQuery.data],
  );

  useEffect(() => {
    if (mode !== "delivery") setDeliveryDetailsOpen(false);
  }, [mode]);

  const deliveryDetailsSummary = useMemo(() => {
    const parts: string[] = [];
    if (deliveryCustomer.trim()) parts.push(deliveryCustomer.trim());
    if (deliveryPhone.trim()) parts.push(deliveryPhone.trim());
    if (deliveryAddress.trim()) parts.push(deliveryAddress.trim());
    if (deliveryRiderId) {
      const rider = activeRiders.find((r) => r.id === deliveryRiderId);
      parts.push(rider?.name ?? "Rider");
    }
    if (deliveryChargePkr > 0) parts.push(String(deliveryChargePkr));
    return parts.length > 0 ? parts.join(" · ") : "Tap to enter delivery details";
  }, [
    deliveryCustomer,
    deliveryPhone,
    deliveryAddress,
    deliveryRiderId,
    deliveryChargePkr,
    activeRiders,
  ]);

  const floorQuery = useQuery({
    queryKey: ["tables", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchFloor(branch!.code),
  });

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchKitchenTickets(branch!.code),
    refetchInterval: 20_000,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCompletedOrders(branch!.code),
    refetchInterval: 20_000,
  });

  const cashSessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!branch?.code || cashSessionQuery.isLoading || cashierPromptShown.current) return;
    if (cashSessionQuery.data) return;
    const skipKey = `pops-cashier-in-dismissed-${branch.code}`;
    if (sessionStorage.getItem(skipKey)) return;
    cashierPromptShown.current = true;
    setCashierModal("in");
  }, [branch?.code, cashSessionQuery.data, cashSessionQuery.isLoading]);

  const categories = menuQuery.data?.categories ?? [];
  const menuItems = menuQuery.data?.items ?? [];
  const floorSections = floorQuery.data?.sections ?? [];
  const floorTables = floorQuery.data?.tables ?? [];

  const recentOrders = useMemo(
    () =>
      buildPosRecentOrders(kitchenQuery.data ?? [], ordersQuery.data ?? [], {
        settings: posSettings,
      }),
    [kitchenQuery.data, ordersQuery.data, posSettings],
  );

  const transferableOrders = useMemo(
    () => recentOrders.filter(canChangePosRecentOrderTable),
    [recentOrders],
  );

  const selectedTable = useMemo(
    () => floorTables.find((t) => t.id === selectedTableId) ?? null,
    [floorTables, selectedTableId],
  );

  const tableLabel = selectedTable ? `Table ${selectedTable.tableNumber}` : undefined;

  const selectedFloorSection = useMemo(
    () => floorSections.find((s) => s.id === selectedFloorSectionId) ?? null,
    [floorSections, selectedFloorSectionId],
  );

  const sectionTables = useMemo(
    () => (selectedFloorSectionId ? floorTables.filter((t) => t.sectionId === selectedFloorSectionId) : []),
    [floorTables, selectedFloorSectionId],
  );

  useEffect(() => {
    if (mode !== "dine-in") {
      setSelectedFloorSectionId(null);
      setSelectedTableId(null);
      setSeatingModalOpen(false);
      seatingAutoOpened.current = false;
      return;
    }
    if (floorSections.length > 0 && !selectedTableId && !seatingAutoOpened.current) {
      setSeatingModalOpen(true);
      seatingAutoOpened.current = true;
    }
  }, [mode, floorSections.length, selectedTableId]);

  useEffect(() => {
    if (!selectedTableId) return;
    const table = floorTables.find((t) => t.id === selectedTableId);
    if (table && table.sectionId !== selectedFloorSectionId) {
      setSelectedFloorSectionId(table.sectionId);
    }
  }, [selectedTableId, floorTables, selectedFloorSectionId]);

  useEffect(() => {
    if (!selectedFloorSectionId) return;
    if (sectionTables.length === 0) {
      setSelectedTableId(null);
      return;
    }
    if (!selectedTableId || !sectionTables.some((t) => t.id === selectedTableId)) {
      setSelectedTableId(sectionTables[0].id);
    }
  }, [selectedFloorSectionId, sectionTables, selectedTableId]);

  const activeCategoryId = categoryId ?? categories[0]?.id ?? null;
  const searchQuery = search.trim();
  const isSearching = searchQuery.length > 0;
  const showFeaturedOnly = menuView === "featured";
  const showAllItems = menuView === "all";

  const featuredCount = useMemo(
    () => menuItems.filter((m) => m.isActive && m.featured).length,
    [menuItems],
  );

  const menuItemOrderCounts = useMemo(
    () => buildMenuItemOrderCounts(ordersQuery.data ?? []),
    [ordersQuery.data],
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filteredMenu = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = menuItems.filter((m) => {
      if (!m.isActive) return false;
      const catOk =
        isSearching ||
        showAllItems ||
        (showFeaturedOnly ? m.featured : !activeCategoryId || m.categoryId === activeCategoryId);
      const searchOk =
        !q ||
        m.name.toLowerCase().includes(q) ||
        formatMenuItemLabel(m).toLowerCase().includes(q) ||
        m.variants.some((v) => v.label.toLowerCase().includes(q)) ||
        (m.barcode?.toLowerCase().includes(q) ?? false) ||
        m.variants.some((v) => v.barcode?.toLowerCase().includes(q)) ||
        (categoryById.get(m.categoryId)?.toLowerCase().includes(q) ?? false);
      return catOk && searchOk;
    });
    if (showAllItems && !isSearching) {
      return sortMenuByPopularity(filtered, menuItemOrderCounts);
    }
    return filtered;
  }, [
    menuItems,
    activeCategoryId,
    searchQuery,
    isSearching,
    showFeaturedOnly,
    showAllItems,
    categoryById,
    menuItemOrderCounts,
  ]);

  function addVariantToCart(item: ApiMenuItem, variant: MenuItemVariant | null): void {
    const line = buildCartLine(item, variant);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.key === line.key);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, line];
    });
  }

  function onDishClick(item: ApiMenuItem): void {
    if (shouldOpenVariantPicker(item)) {
      setVariantPickerItem(item);
      return;
    }
    addVariantToCart(item, pickDefaultVariant(item));
  }

  function setQty(lineKey: string, qty: number): void {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.key !== lineKey);
      return prev.map((l) => (l.key === lineKey ? { ...l, qty } : l));
    });
  }

  const effectiveCart = useMemo(
    () => applyHappyHourBonus(cart, menuItems, happyHourSettings),
    [cart, menuItems, happyHourSettings],
  );

  const happyHourBonus = useMemo(
    () => resolveHappyHourBonusItem(menuItems, happyHourSettings),
    [menuItems, happyHourSettings],
  );

  const happyHourActiveSlot = useMemo(
    () => getActiveHappyHourSlot(happyHourSettings),
    [happyHourSettings],
  );

  const happyHourGiftItemIds = useMemo(
    () => new Set(happyHourSettings.slots.map((s) => s.bonusMenuItemId).filter(Boolean)),
    [happyHourSettings.slots],
  );

  const happyHourLive = isHappyHourActive(happyHourSettings);

  const subtotal = effectiveCart.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  useEffect(() => {
    setDiscountAmountInput((prev) => clampDiscountPkr(prev, subtotal));
  }, [subtotal]);

  const ticketTotals = useMemo(() => {
    const discountSeed =
      discountEditedAs === "pct"
        ? discountAmountFromPct(discountPctInput, subtotal)
        : clampDiscountPkr(discountAmountInput, subtotal);
    const charge = mode === "delivery" ? deliveryChargePkr : 0;
    return computeTicketTotals(subtotal, discountSeed, ticketServicePct, taxPct, charge);
  }, [
    subtotal,
    discountPctInput,
    discountAmountInput,
    discountEditedAs,
    ticketServicePct,
    taxPct,
    mode,
    deliveryChargePkr,
  ]);

  const { discount, discountPct, service, tax, deliveryCharge, total } = ticketTotals;

  const deliveryExtras = () =>
    mode === "delivery"
      ? {
          riderId: deliveryRiderId || undefined,
          deliveryChargePkr: deliveryChargePkr || 0,
        }
      : {};

  function onDiscountPctChange(raw: number): void {
    const pct = Math.max(0, Math.min(50, raw));
    setDiscountEditedAs("pct");
    setDiscountPctInput(pct);
    setDiscountAmountInput(discountAmountFromPct(pct, subtotal));
  }

  function onDiscountAmountChange(raw: number): void {
    const amount = clampDiscountPkr(raw, subtotal);
    setDiscountEditedAs("amount");
    setDiscountAmountInput(amount);
    setDiscountPctInput(discountPctFromAmount(amount, subtotal));
  }

  const modeLabel = posOrderModeLabel(mode);
  const orderNotes = posDeliveryNotes(deliveryCustomer, deliveryPhone, deliveryAddress);
  const stationLabel = posStationLabel(mode, tableLabel);
  const billTableLabel = posBillTableLabel(mode, tableLabel);

  function buildPrintPayload(): Omit<PrintTicketInput, "kind"> {
    return {
      branchName: branch?.name ?? "POPS",
      branchCode: branch?.code ?? "—",
      orderRef,
      modeLabel,
      tableLabel: posPrintTableLabel(mode, tableLabel),
      notes: orderNotes,
      lines: effectiveCart.map((line) => ({
        label: line.lineLabel,
        qty: line.qty,
        unitPrice: line.unitPrice,
      })),
      subtotal,
      discount,
      service,
      tax,
      deliveryCharge: mode === "delivery" && deliveryCharge > 0 ? deliveryCharge : undefined,
      total,
      servicePct: ticketServicePct,
      taxPct,
      discountPct,
    };
  }

  const kitchenLines = () =>
    effectiveCart.map((line) => ({
      label: line.lineLabel,
      qty: line.qty,
      unitPrice: line.unitPrice,
      menuItemId: line.item.id,
    }));

  function invalidateOrderFeeds(): void {
    void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  function resetAfterKitchenOrder(): void {
    setOrderRef(nextOrderRef(branch?.code));
    setCart([]);
    setDeliveryCustomer("");
    setDeliveryPhone("");
    setDeliveryAddress("");
    setDeliveryRiderId("");
    setDeliveryChargePkr(loadDeliverySettings(branch?.code).defaultChargePkr);
    setDeliveryDetailsOpen(false);
  }

  function resetAfterBill(): void {
    resetAfterKitchenOrder();
    setDiscountPctInput(0);
    setDiscountAmountInput(0);
    setDiscountEditedAs("pct");
    setEditingOrder(null);
  }

  function applyTableFromStation(stationLabel: string): void {
    const tableNumber = tableNumberFromStation(stationLabel);
    if (!tableNumber) {
      setSelectedTableId(null);
      return;
    }
    const table = floorTables.find((row) => row.tableNumber === tableNumber);
    if (table) {
      setSelectedFloorSectionId(table.sectionId);
      setSelectedTableId(table.id);
    }
  }

  function applyTicketToPos(ticket: KitchenTicket): void {
    setEditingOrder({ kind: "ticket", ticketId: ticket.id });
    setOrderRef(ticket.orderRef ?? ticket.ticketRef);
    setMode(inferPosModeFromStation(ticket.stationLabel));
    setCart(stripComplimentaryLines(cartFromKitchenTicket(menuItems, ticket)));
    setDiscountPctInput(0);
    setDiscountAmountInput(0);
    setDiscountEditedAs("pct");
    setDeliveryRiderId(ticket.riderId ?? "");
    setDeliveryChargePkr(ticket.deliveryChargePkr ?? 0);
    const delivery = parseDeliveryFieldsFromNotes(ticket.notes ?? null);
    setDeliveryCustomer(delivery.customer);
    setDeliveryPhone(delivery.phone);
    setDeliveryAddress(delivery.address);
    applyTableFromStation(ticket.stationLabel);
    if (inferPosModeFromStation(ticket.stationLabel) === "delivery") {
      setDeliveryDetailsOpen(true);
    }
    setPrintNotice(`Editing ${ticket.orderRef ?? ticket.ticketRef}. Add or remove items, then update.`);
  }

  function applyBillToPos(bill: Bill): void {
    setEditingOrder({ kind: "held-bill", billId: bill.id });
    setOrderRef(bill.orderRef ?? bill.billRef);
    setMode(inferPosModeFromStation(bill.tableLabel));
    setCart(stripComplimentaryLines(cartFromBill(menuItems, bill)));
    setTicketServicePct(bill.servicePct);
    setDiscountAmountInput(bill.discount);
    setDiscountPctInput(bill.subtotal > 0 ? Math.round((bill.discount / bill.subtotal) * 100) : 0);
    setDiscountEditedAs("amount");
    setDeliveryRiderId(bill.riderId ?? "");
    setDeliveryChargePkr(bill.deliveryChargePkr ?? 0);
    const delivery = parseDeliveryFieldsFromNotes(bill.notes);
    setDeliveryCustomer(delivery.customer);
    setDeliveryPhone(delivery.phone);
    setDeliveryAddress(delivery.address);
    applyTableFromStation(bill.tableLabel);
    if (inferPosModeFromStation(bill.tableLabel) === "delivery") {
      setDeliveryDetailsOpen(true);
    }
    setPrintNotice(`Editing held bill ${bill.orderRef ?? bill.billRef}.`);
  }

  function loadRecentOrderForEdit(order: PosRecentOrder): void {
    if (order.kind === "pending" && order.kitchenTicket) {
      applyTicketToPos(order.kitchenTicket);
      return;
    }
    if (order.bill?.status === "held") {
      applyBillToPos(order.bill);
    }
  }

  function loadRecentOrderForPayment(order: PosRecentOrder): void {
    if (!canPayPosRecentOrder(order)) {
      setPrintNotice("This order is already paid.");
      return;
    }
    if (order.kind === "pending" && order.kitchenTicket) {
      applyTicketToPos(order.kitchenTicket);
      setCheckoutModal("pay");
      return;
    }
    if (order.bill?.status === "held") {
      applyBillToPos(order.bill);
      setCheckoutModal("pay");
    }
  }

  function cancelEditing(): void {
    resetAfterBill();
    setPrintNotice("Edit cancelled.");
  }

  function openTableTransfer(): void {
    if (editingOrder?.kind === "ticket" && mode === "dine-in") {
      const ticket = (kitchenQuery.data ?? []).find((row) => row.id === editingOrder.ticketId);
      if (ticket && ticket.status !== "done") {
        setTableTransferTicket({
          id: ticket.id,
          stationLabel: ticket.stationLabel,
          orderRef: ticket.orderRef,
          ticketRef: ticket.ticketRef,
          createdAt: ticket.createdAt,
        });
        return;
      }
    }

    if (transferableOrders.length === 0) {
      setPrintNotice("No active dine-in orders available for table transfer.");
      return;
    }
    if (transferableOrders.length === 1 && transferableOrders[0]!.pendingTicket) {
      setTableTransferTicket(transferableOrders[0]!.pendingTicket!);
      return;
    }
    setTableTransferPickerOpen(true);
  }

  useEffect(() => {
    const pending = pendingEditRef.current;
    if (!pending || menuItems.length === 0) return;
    if (pending.editTicketId) {
      const ticket = (kitchenQuery.data ?? []).find((row) => row.id === pending.editTicketId);
      if (ticket) {
        applyTicketToPos(ticket);
        pendingEditRef.current = null;
      }
    } else if (pending.editBillId) {
      const bill = (ordersQuery.data ?? []).find((row) => row.id === pending.editBillId);
      if (bill) {
        applyBillToPos(bill);
        pendingEditRef.current = null;
      }
    }
  }, [kitchenQuery.data, ordersQuery.data, menuItems.length]);

  function validateDeliveryRider(): string | null {
    if (mode !== "delivery") return null;
    if (activeRiders.length === 0) {
      return "Add an active rider in Delivery before creating delivery orders.";
    }
    if (!deliveryRiderId) {
      return "Assign a rider for delivery orders.";
    }
    return null;
  }

  function validateKitchenOrder(): string | null {
    if (cart.length === 0) return "Add items to the ticket.";
    if (!branch?.code) return "Select a branch first.";
    if (mode === "dine-in" && !tableLabel) {
      setSeatingModalOpen(true);
      return "Select a table for dine-in orders.";
    }
    const riderErr = validateDeliveryRider();
    if (riderErr) return riderErr;
    return null;
  }

  function validateBillCheckout(): string | null {
    if (cart.length === 0) return "Add items before checkout.";
    if (!branch?.code) return "Select a branch first.";
    if (mode === "dine-in" && !tableLabel) {
      setSeatingModalOpen(true);
      return "Select a table for dine-in orders.";
    }
    const riderErr = validateDeliveryRider();
    if (riderErr) return riderErr;
    return null;
  }

  const createOrderMutation = useMutation({
    mutationFn: () => {
      const err = validateKitchenOrder();
      if (err) throw new Error(err);
      if (editingOrder?.kind === "ticket") {
        return updateKitchenTicket(editingOrder.ticketId, {
          stationLabel,
          lines: kitchenLines(),
          notes: orderNotes ?? null,
          ...deliveryExtras(),
        });
      }
      return createKitchenTicket({
        branchCode: branch!.code,
        orderRef,
        stationLabel,
        lines: kitchenLines(),
        notes: orderNotes,
        ...deliveryExtras(),
      });
    },
    onSuccess: () => {
      const wasTicketEdit = editingOrder?.kind === "ticket";
      printKot(buildKotPrintPayload());
      invalidateOrderFeeds();
      resetAfterKitchenOrder();
      setEditingOrder(null);
      setPrintNotice(
        wasTicketEdit
          ? `${modeLabel} order updated and sent to kitchen.`
          : `${modeLabel} order saved and sent to kitchen.`,
      );
    },
    onError: (err: Error) => setPrintNotice(err.message),
  });

  const updateHeldBillMutation = useMutation({
    mutationFn: () => {
      const err = validateBillCheckout();
      if (err) throw new Error(err);
      if (editingOrder?.kind !== "held-bill") {
        throw new Error("No held bill selected for editing.");
      }
      return updateBill(editingOrder.billId, {
        tableLabel: billTableLabel,
        lines: cartToBillLines(effectiveCart),
        notes: orderNotes ?? null,
        discountPkr: discount,
        servicePct: ticketServicePct,
        taxPct,
        riderId: deliveryRiderId || null,
        deliveryChargePkr: mode === "delivery" ? deliveryChargePkr : 0,
      });
    },
    onSuccess: () => {
      invalidateOrderFeeds();
      setPrintNotice("Held bill updated.");
    },
    onError: (err: Error) => setPrintNotice(err.message),
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({
      intent,
      servicePct: checkoutServicePct,
      taxPct: checkoutTaxPct,
      payments,
      status,
    }: {
      intent: "pay" | "invoice" | "hold";
      servicePct: number;
      taxPct: number;
      payments: { method: "cash" | "card" | "wallet" | "bank"; amount: number }[];
      status: "completed" | "held";
    }) => {
      const err = validateBillCheckout();
      if (err) throw new Error(err);
      if (editingOrder?.kind === "held-bill") {
        const updated = await updateBill(editingOrder.billId, {
          tableLabel: billTableLabel,
          lines: cartToBillLines(effectiveCart),
          notes: orderNotes ?? null,
          discountPkr: discount,
          servicePct: checkoutServicePct,
          taxPct: checkoutTaxPct,
          riderId: deliveryRiderId || null,
          deliveryChargePkr: mode === "delivery" ? deliveryChargePkr : 0,
        });
        if (status === "held") {
          return { bill: updated, intent };
        }
        const completed = await completeBill(editingOrder.billId, {
          payments,
          servicePct: checkoutServicePct,
          taxPct: checkoutTaxPct,
        });
        return { bill: completed, intent };
      }
      const bill = await createBill({
        branchCode: branch!.code,
        orderRef,
        tableLabel: billTableLabel,
        waiterName: "POS Counter",
        notes: orderNotes,
        lines: cartToBillLines(effectiveCart),
        discountPct: discount > 0 ? discountPct : undefined,
        discountPkr: discount > 0 ? discount : undefined,
        servicePct: checkoutServicePct,
        taxPct: checkoutTaxPct,
        status,
        payments: status === "completed" ? payments : undefined,
        ...deliveryExtras(),
      });
      return { bill, intent };
    },
    onSuccess: ({ bill, intent }) => {
      setCheckoutModal(null);
      invalidateOrderFeeds();
      void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
      if (intent === "hold") {
        resetAfterBill();
        setPrintNotice(`Bill ${bill.billRef} held — complete payment from Orders.`);
        return;
      }
      const payload = buildPrintPayload();
      const ok = printReceipt({ ...payload, billRef: bill.billRef, waiterName: bill.waiterName });
      resetAfterBill();
      if (intent === "invoice") {
        setPrintNotice(
          ok ? `Invoice printed — ${bill.billRef} saved to orders.` : `${bill.billRef} saved; print failed.`,
        );
      } else {
        setPrintNotice(ok ? `${modeLabel} paid — ${bill.billRef}` : `${bill.billRef} saved; print failed.`);
      }
    },
    onError: (err: Error) => setPrintNotice(err.message),
  });

  const splitBillMutation = useMutation({
    mutationFn: async (splits: SplitBillPart[]) => {
      const err = validateBillCheckout();
      if (err) throw new Error(err);
      const groupRef = orderRef;
      const bills = [];
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        const splitSubtotal = split.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        const shareDiscount =
          subtotal > 0 ? Math.round((splitSubtotal / subtotal) * discount) : 0;
        const shareDelivery =
          mode === "delivery" && subtotal > 0
            ? Math.round((splitSubtotal / subtotal) * deliveryChargePkr)
            : 0;
        const bill = await createBill({
          branchCode: branch!.code,
          orderRef,
          tableLabel: billTableLabel,
          waiterName: "POS Counter",
          notes: orderNotes ? `${orderNotes} · ${split.label}` : split.label,
          lines: cartToBillLines(split.lines),
          discountPkr: shareDiscount > 0 ? shareDiscount : undefined,
          servicePct: split.servicePct,
          taxPct: split.taxPct,
          status: "completed",
          payments: split.payments,
          splitGroupRef: `${groupRef}-S${i + 1}`,
          ...(mode === "delivery"
            ? {
                riderId: deliveryRiderId || undefined,
                deliveryChargePkr: shareDelivery,
              }
            : {}),
        });
        bills.push(bill);
      }
      return bills;
    },
    onSuccess: (bills) => {
      setSplitModalOpen(false);
      invalidateOrderFeeds();
      void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
      resetAfterBill();
      setPrintNotice(`${bills.length} split bills created — ${bills.map((b) => b.billRef).join(", ")}`);
    },
    onError: (err: Error) => setPrintNotice(err.message),
  });

  function buildKotPrintPayload(): Omit<PrintTicketInput, "kind"> {
    const payload = buildPrintPayload();
    return {
      ...payload,
      lines: payload.lines.map((line) => ({ ...line, unitPrice: 0 })),
      subtotal: 0,
      discount: 0,
      service: 0,
      tax: 0,
      total: 0,
    };
  }

  function runPrintOrder(): void {
    createOrderMutation.mutate();
  }

  function onPay(): void {
    setPrintNotice(null);
    setCheckoutModal("pay");
  }

  function runPrintInvoice(): void {
    setCheckoutModal("invoice");
  }

  function openHoldBill(): void {
    setCheckoutModal("hold");
  }

  function openSplitBill(): void {
    const err = validateBillCheckout();
    if (err) {
      setPrintNotice(err);
      return;
    }
    setSplitModalOpen(true);
  }

  const seatingLabel =
    mode === "dine-in" && selectedTable && selectedFloorSection
      ? `${selectedFloorSection.name} · Table ${selectedTable.tableNumber}`
      : mode === "dine-in"
        ? "Select table"
        : null;

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] flex-col gap-2">
      {/* Compact toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-2.5 py-2">
        <div className="shrink-0 text-sm font-semibold text-white">POS</div>
        <input
          placeholder="Search menu or scan SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 basis-[10rem] rounded-md border border-slate-700/80 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/40 sm:max-w-md"
        />
        <div className="flex w-full shrink-0 flex-wrap items-center gap-1 sm:ml-auto sm:w-auto">
          {cashSessionQuery.data ? (
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
              Shift open · {cashSessionQuery.data.sessionRef}
            </span>
          ) : (
            <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">
              No shift — Cashier in required
            </span>
          )}
          <button
            type="button"
            className={POS_TOOLBAR_BTN}
            onClick={() => setCashierModal("in")}
          >
            Cashier in
          </button>
          <button
            type="button"
            className={POS_TOOLBAR_BTN}
            onClick={() => setCashierModal("out")}
            disabled={!cashSessionQuery.data}
          >
            Cashier out
          </button>
          <button type="button" className={POS_TOOLBAR_BTN} onClick={openTableTransfer}>
            Table transfer
          </button>
          <button type="button" className={POS_TOOLBAR_BTN} onClick={openSplitBill}>
            Merge / split
          </button>
          <button type="button" className={POS_TOOLBAR_BTN} onClick={() => setPayOutModalOpen(true)}>
            Paying out
          </button>
        </div>
      </div>

      {menuQuery.isError ? (
        <p className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Could not load menu — {(menuQuery.error as Error).message}
        </p>
      ) : null}

      {seatingModalOpen && mode === "dine-in" ? (
        <PosSeatingModal
          sections={floorSections}
          tables={floorTables}
          selectedSectionId={selectedFloorSectionId}
          selectedTableId={selectedTableId}
          isLoading={floorQuery.isLoading}
          onSelectSection={setSelectedFloorSectionId}
          onSelectTable={setSelectedTableId}
          onClose={() => setSeatingModalOpen(false)}
        />
      ) : null}

      {variantPickerItem ? (
        <PosDishVariantModal
          item={variantPickerItem}
          variants={resolvePosSellableVariants(variantPickerItem)}
          onSelect={(variant) => {
            addVariantToCart(variantPickerItem, variant);
            setVariantPickerItem(null);
          }}
          onClose={() => setVariantPickerItem(null)}
        />
      ) : null}

      {/* Main POS grid */}
      <div className="grid flex-1 grid-cols-12 gap-3 lg:items-start">
        {/* Menu column */}
        <div className="col-span-12 flex min-h-0 flex-col lg:col-span-4 lg:sticky lg:top-0 lg:h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-9rem)]">
          {/* Category pills */}
          {categories.length > 0 ? (
            <div className="mb-1.5 flex shrink-0 gap-1 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setMenuView("all")}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  showAllItems
                    ? "bg-slate-700 text-white"
                    : "bg-slate-900/60 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setMenuView("featured")}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${
                  showFeaturedOnly
                    ? amberPillActiveClass
                    : pillInactiveClass
                }`}
              >
                <span aria-hidden>★</span>
                Featured
                {featuredCount > 0 ? (
                  <span className="rounded-full bg-slate-950/60 px-1.5 text-[10px] tabular-nums">
                    {featuredCount}
                  </span>
                ) : null}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setMenuView("category");
                    setCategoryId(c.id);
                  }}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    menuView === "category" && activeCategoryId === c.id
                      ? "bg-slate-700 text-white"
                      : "bg-slate-900/60 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}

          {showAllItems && !isSearching ? (
            <p className="mb-1 shrink-0 text-[10px] text-slate-500">
              {filteredMenu.length === 0
                ? "No menu items yet."
                : `${filteredMenu.length} item${filteredMenu.length === 1 ? "" : "s"} · most ordered first`}
            </p>
          ) : null}

          {showFeaturedOnly && !isSearching ? (
            <p className="mb-1 shrink-0 text-[10px] text-slate-500">
              {filteredMenu.length === 0
                ? "No featured dishes yet — mark items in Menu."
                : `${filteredMenu.length} featured item${filteredMenu.length === 1 ? "" : "s"} across all categories`}
            </p>
          ) : null}

          {isSearching ? (
            <p className="mb-1 shrink-0 text-[10px] text-slate-500">
              {filteredMenu.length === 0
                ? `No match for “${searchQuery}”.`
                : `${filteredMenu.length} result${filteredMenu.length === 1 ? "" : "s"}`}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
            {menuQuery.isLoading ? (
              <p className="text-xs text-slate-500">Loading menu…</p>
            ) : filteredMenu.length === 0 ? (
              <p className="text-xs text-slate-500">
                {showFeaturedOnly
                  ? "No featured items to show."
                  : showAllItems
                    ? "No menu items to show."
                    : "No items in this category."}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredMenu.map((item) => {
                  const img = resolveMenuImageUrl(item.imageUrl);
                  const variants = resolvePosSellableVariants(item);
                  const displayPrice = happyHourActiveSlot?.percentOff
                    ? applyHappyHourDiscountPrice(menuItemDisplayPrice(item), happyHourActiveSlot.percentOff)
                    : menuItemDisplayPrice(item);
                  const showHappyHourPrice =
                    happyHourActiveSlot != null &&
                    happyHourActiveSlot.percentOff > 0 &&
                    displayPrice !== menuItemDisplayPrice(item);
                  const hasPicker = variants.length > 1;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onDishClick(item)}
                      className="flex flex-col rounded border border-slate-800/80 bg-slate-900/40 p-1 text-left transition hover:border-amber-500/30 hover:bg-slate-900"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="mb-0.5 h-9 w-full rounded-sm object-cover"
                        />
                      ) : (
                        <div className="mb-0.5 flex h-9 items-center justify-center rounded-sm bg-slate-950/60 text-[8px] text-slate-600">
                          {isSearching || showFeaturedOnly || showAllItems
                            ? categoryById.get(item.categoryId)
                            : "—"}
                        </div>
                      )}
                      <span className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-100">
                        {item.featured ? (
                          <span className="mr-0.5 text-amber-700 dark:text-amber-300" aria-hidden>
                            ★
                          </span>
                        ) : null}
                        {item.name}
                      </span>
                      <span className="mt-px text-[10px] font-semibold text-amber-200/90">
                        {hasPicker ? "From " : ""}{displayPrice.toLocaleString()}
                        {showHappyHourPrice ? (
                          <span className="ml-1 font-normal text-slate-500 line-through">
                            {menuItemDisplayPrice(item).toLocaleString()}
                          </span>
                        ) : null}
                      </span>
                      {item.featured || item.barcode || happyHourGiftItemIds.has(item.id) ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                          {item.featured ? (
                            <span className="rounded bg-amber-500/15 px-0.5 text-[8px] text-amber-400">★</span>
                          ) : null}
                          {happyHourGiftItemIds.has(item.id) ? (
                            <span className="rounded bg-amber-500/15 px-0.5 text-[8px] text-amber-400">HH</span>
                          ) : null}
                          {item.barcode ? (
                            <span className="truncate text-[8px] text-slate-600">{item.barcode}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Current ticket — grows with cart items; page scrolls instead of inner cart scroll */}
        <div className="col-span-12 flex min-h-[36rem] flex-col rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 lg:col-span-4 dark:border-slate-700/50 dark:bg-gradient-to-b dark:from-slate-900/95 dark:to-slate-950 dark:shadow-xl dark:shadow-black/25 dark:ring-1 dark:ring-white/5">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/40 dark:backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {editingOrder ? "Editing" : "Current ticket"}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {editingOrder ? "Modify order" : "New order"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingOrder ? (
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                ) : null}
                <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-sm font-bold tracking-wide text-amber-800 ring-1 ring-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/25">
                  {orderRef}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800/80 dark:bg-slate-900/30">
            <div className={POS_MODE_BAR}>
              {POS_ORDER_MODES.map(({ id, label }) => (
                <button key={id} type="button" onClick={() => setMode(id)} className={POS_MODE_BTN(mode === id)}>
                  {label}
                </button>
              ))}
            </div>

            {mode === "dine-in" && floorSections.length > 0 ? (
              <button
                type="button"
                onClick={() => setSeatingModalOpen(true)}
                className={`mt-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                  selectedTableId
                    ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <span>{seatingLabel ?? "Select table"}</span>
                <span className="text-slate-400 dark:text-slate-500" aria-hidden>
                  ›
                </span>
              </button>
            ) : null}

            {mode === "takeaway" ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-300">
                Takeaway counter
              </div>
            ) : null}

            {mode === "delivery" ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setDeliveryDetailsOpen((open) => !open)}
                  aria-expanded={deliveryDetailsOpen}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                    deliveryDetailsOpen
                      ? "border-amber-400/60 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-950/60 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">{deliveryDetailsSummary}</span>
                  <span
                    className={`shrink-0 text-[10px] text-slate-400 transition-transform dark:text-slate-500 ${
                      deliveryDetailsOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </button>
                {deliveryDetailsOpen ? (
                  <div className="mt-1.5 grid grid-cols-1 gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700/60 dark:bg-slate-950/40">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        placeholder="Customer"
                        value={deliveryCustomer}
                        onChange={(e) => setDeliveryCustomer(e.target.value)}
                        className={`${TICKET_INPUT_CLASS} py-1.5`}
                      />
                      <input
                        placeholder="Phone"
                        type="tel"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        className={`${TICKET_INPUT_CLASS} py-1.5`}
                      />
                    </div>
                    <input
                      placeholder="Delivery address"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className={`${TICKET_INPUT_CLASS} py-1.5`}
                    />
                    <div className="grid grid-cols-[minmax(0,1fr)_4.75rem] gap-1.5">
                      <select
                        value={deliveryRiderId}
                        onChange={(e) => setDeliveryRiderId(e.target.value)}
                        required
                        className={`${TICKET_INPUT_CLASS} py-1.5 ${
                          !deliveryRiderId ? "border-amber-400 dark:border-amber-500/40" : ""
                        }`}
                      >
                        <option value="">Rider *</option>
                        {activeRiders.map((rider) => (
                          <option key={rider.id} value={rider.id}>
                            {rider.name}
                            {rider.phone ? ` · ${rider.phone}` : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        max={50000}
                        placeholder="Charge"
                        title="Delivery charge"
                        value={deliveryChargePkr}
                        onChange={(e) => setDeliveryChargePkr(Math.max(0, Number(e.target.value) || 0))}
                        className={`${TICKET_INPUT_CLASS} py-1.5 text-right tabular-nums`}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {happyHourLive && happyHourActiveSlot ? (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-900 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-semibold">Happy hour active</span>
                <span className="text-amber-800/80 dark:text-amber-200/80">
                  {" "}
                  · {formatHappyHourSlotSummary(happyHourActiveSlot)}
                  {happyHourBonus ? ` · Free ${happyHourBonus.item.name}` : ""}
                </span>
              </div>
            ) : null}
          </div>

          {printNotice ? (
            <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              {printNotice}
            </p>
          ) : null}

          <div className="p-3">
            {effectiveCart.length === 0 ? (
              <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center dark:border-slate-700/60 dark:bg-slate-950/30">
                <div className="mb-2 text-2xl opacity-40" aria-hidden>
                  🛒
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">No items yet</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-600">
                  Tap menu items to add to this ticket
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {effectiveCart.map((line) => (
                  <li
                    key={line.key}
                    className={`flex min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 transition ${
                      line.isComplimentary
                        ? "border-amber-400/40 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/50 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{line.lineLabel}</div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                        {line.isComplimentary ? (
                          <span className="font-medium text-amber-700 dark:text-amber-400">Free</span>
                        ) : (
                          <>Rs {line.unitPrice.toLocaleString()} each</>
                        )}
                      </div>
                    </div>
                    {line.isComplimentary ? (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                        FREE
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-sm leading-none text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          onClick={() => setQty(line.key, line.qty - 1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-[1.25rem] text-center text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-sm leading-none text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          onClick={() => setQty(line.key, line.qty + 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] dark:border-slate-800/80 dark:bg-slate-950/95 dark:shadow-[0_-4px_12px_rgba(0,0,0,0.35)]">
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800/80">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Disc %
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={discountEditedAs === "pct" ? discountPctInput : discountPct}
                    onChange={(e) => onDiscountPctChange(Number(e.target.value) || 0)}
                    className={TICKET_NUMBER_INPUT_CLASS}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Disc Rs
                  <input
                    type="number"
                    min={0}
                    max={subtotal}
                    value={discountEditedAs === "amount" ? discountAmountInput : discount}
                    onChange={(e) => onDiscountAmountChange(Number(e.target.value) || 0)}
                    className={TICKET_NUMBER_INPUT_CLASS}
                  />
                </label>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-300">
                    {subtotal.toLocaleString()}
                  </span>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400/90">
                    <span>Discount</span>
                    <span className="tabular-nums">− {discount.toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Service {ticketServicePct}%</span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-300">
                    {service.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax {taxPct}%</span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-300">
                    {tax.toLocaleString()}
                  </span>
                </div>
                {mode === "delivery" && deliveryCharge > 0 ? (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Delivery</span>
                    <span className="tabular-nums text-slate-900 dark:text-slate-300">
                      {deliveryCharge.toLocaleString()}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Total</span>
                <span className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {editingOrder?.kind === "held-bill" ? (
                <button
                  type="button"
                  className={`${POS_PRIMARY_ORDER_BTN} col-span-2`}
                  disabled={cart.length === 0 || updateHeldBillMutation.isPending || !branch?.code}
                  onClick={() => updateHeldBillMutation.mutate()}
                >
                  {updateHeldBillMutation.isPending ? "…" : "Update hold"}
                </button>
              ) : (
                <button
                  type="button"
                  className={POS_PRIMARY_ORDER_BTN}
                  disabled={cart.length === 0 || createOrderMutation.isPending || !branch?.code}
                  onClick={() => createOrderMutation.mutate()}
                >
                  {createOrderMutation.isPending
                    ? "…"
                    : editingOrder?.kind === "ticket"
                      ? "Update order"
                      : "Order"}
                </button>
              )}
              <button
                type="button"
                className={`${POS_PRIMARY_PAY_BTN}${editingOrder?.kind === "held-bill" ? " col-span-2" : ""}`}
                disabled={cart.length === 0 || checkoutMutation.isPending}
                onClick={() => onPay()}
              >
                {checkoutMutation.isPending ? "…" : "Pay"}
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={POS_SECONDARY_BTN}
                disabled={cart.length === 0 || createOrderMutation.isPending || !branch?.code}
                onClick={() => runPrintOrder()}
              >
                {createOrderMutation.isPending ? "…" : "Print order"}
              </button>
              <button
                type="button"
                className={POS_SECONDARY_BTN}
                disabled={cart.length === 0 || checkoutMutation.isPending}
                onClick={() => runPrintInvoice()}
              >
                Print invoice
              </button>
            </div>
          </div>
        </div>

        {/* Latest orders sidebar */}
        <div className="col-span-12 flex min-h-[18rem] flex-col lg:col-span-4 lg:sticky lg:top-0 lg:h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-9rem)]">
          <PosLatestOrdersPanel
            orders={recentOrders}
            isLoading={kitchenQuery.isLoading || ordersQuery.isLoading}
            isError={kitchenQuery.isError || ordersQuery.isError}
            onEdit={loadRecentOrderForEdit}
            onPayOrder={loadRecentOrderForPayment}
          />
        </div>
      </div>

      {checkoutModal ? (
        <PosCheckoutModal
          mode={checkoutModal}
          title={
            checkoutModal === "hold"
              ? "Hold bill"
              : checkoutModal === "invoice"
                ? "Print invoice"
                : "Complete payment"
          }
          subtotal={subtotal}
          discount={discount}
          servicePct={ticketServicePct}
          taxPct={taxPct}
          total={total}
          service={service}
          tax={tax}
          deliveryCharge={deliveryCharge}
          isSubmitting={checkoutMutation.isPending}
          onClose={() => setCheckoutModal(null)}
          onValidationError={(message) => setPrintNotice(message)}
          onConfirm={({ servicePct: checkoutServicePct, taxPct: checkoutTaxPct, payments, status }) =>
            checkoutMutation.mutate({
              intent: checkoutModal,
              servicePct: checkoutServicePct,
              taxPct: checkoutTaxPct,
              payments,
              status,
            })
          }
        />
      ) : null}

      {splitModalOpen ? (
        <PosSplitBillModal
          cart={cart}
          discount={discount}
          servicePct={ticketServicePct}
          taxPct={taxPct}
          isSubmitting={splitBillMutation.isPending}
          onClose={() => setSplitModalOpen(false)}
          onConfirm={(splits) => splitBillMutation.mutate(splits)}
        />
      ) : null}

      {tableTransferPickerOpen ? (
        <PosTableTransferPickerModal
          orders={transferableOrders}
          onClose={() => setTableTransferPickerOpen(false)}
          onPick={(ticket) => {
            setTableTransferPickerOpen(false);
            setTableTransferTicket(ticket);
          }}
        />
      ) : null}

      {tableTransferTicket && branch?.code ? (
        <ChangeOrderTableModal
          ticket={tableTransferTicket}
          branchCode={branch.code}
          onClose={() => setTableTransferTicket(null)}
          onSuccess={(message) => {
            setPrintNotice(message);
            if (editingOrder?.kind === "ticket" && editingOrder.ticketId === tableTransferTicket.id) {
              void queryClient.invalidateQueries({ queryKey: ["kitchen", branch.code] });
            }
          }}
        />
      ) : null}

      {payOutModalOpen ? (
        <PosPayOutModal
          onClose={() => setPayOutModalOpen(false)}
          onSuccess={(message) => setPrintNotice(message)}
        />
      ) : null}

      {cashierModal && branch?.code ? (
        <PosCashierModal
          mode={cashierModal}
          orders={ordersQuery.data ?? []}
          onClose={() => {
            if (cashierModal === "in" && branch?.code && !cashSessionQuery.data) {
              sessionStorage.setItem(`pops-cashier-in-dismissed-${branch.code}`, "1");
            }
            setCashierModal(null);
          }}
          onSuccess={(message) => {
            if (branch?.code) sessionStorage.removeItem(`pops-cashier-in-dismissed-${branch.code}`);
            void cashSessionQuery.refetch();
            setPrintNotice(message);
          }}
        />
      ) : null}
    </div>
  );
}
