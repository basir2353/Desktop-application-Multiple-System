import {
  formatMenuItemLabel,
  formatMenuItemPrintLabel,
  menuItemDisplayPrice,
  type Bill,
  type ExpenseCategory,
  type KitchenTicket,
  type MenuItem as ApiMenuItem,
  type MenuItemVariant,
  type PraFiscalInvoice,
  type PraInvoiceMode,
  EXPENSE_CATEGORIES,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchTaxAuthorityStatus } from "../../../lib/taxAuthorityApi";
import { usePopsStore } from "../../../stores/popsStore";
import { useSessionStore } from "../../../stores/sessionStore";
import { useThemeStore } from "../../../stores/themeStore";
import { fetchCompletedOrders, createBill, completeBill, updateBill } from "../../api/billing";
import { PraFiscalInvoiceModal } from "../../components/PraFiscalInvoiceModal";
import { PraModeConfirmDialog } from "../../components/PraModeConfirmDialog";
import {
  isPraFakeEnabled,
  isPraRealEnabled,
  useTaxAuthorityFeatures,
} from "../../hooks/useTaxAuthorityFeatures";
import {
  printIssuedPraSlip,
} from "../../lib/praIssueFlow";
import { fetchCustomerInvoices, fetchOpenCashSession } from "../../api/accounting";
import { fetchClosingStatus } from "../../api/closing";
import { fetchRiders } from "../../api/delivery";
import { createKitchenTicket, fetchKitchenTickets, isKitchenTicketMissingError, updateKitchenTicket } from "../../api/kitchen";
import { fetchBranchMenu } from "../../api/menu";
import { fetchBranchFloor } from "../../api/tables";
import { PosDishVariantModal } from "../../components/PosDishVariantModal";
import { PosItemPromptModal } from "../../components/PosItemPromptModal";
import { PosLatestOrdersPanel } from "../../components/PosLatestOrdersPanel";
import { PosOrderTypeModal } from "../../components/PosOrderTypeModal";
import { PosFullScreenMenuOverlay } from "../../components/PosFullScreenMenuOverlay";
import { PosSeatingModal } from "../../components/PosSeatingModal";
import {
  POS_ORDER_MODES,
  parseStaffFoodPersonFromStation,
  posBillTableLabel,
  posCustomerOrderNotes,
  posDeliveryNotes,
  posModeAutoPrintsOnCustomer,
  posModeShowsCustomerPanel,
  posOrderModeLabel,
  posPrintTableLabel,
  posStaffFoodNotes,
  posStationLabel,
  type PosOrderMode,
  type StaffFoodConsumerType,
} from "../../lib/posOrderMode";
import {
  buildCartLine,
  cartLinePrintLabel,
  cartLineGross,
  canEditLineDiscount,
  cartLineManualDiscountPkr,
  cartLineNet,
  isMenuItemDiscountable,
  itemNeedsPosPrompt,
  lineBlocksBillDiscount,
  nextCartSortOrder,
  pickDefaultVariant,
  resolvePosSellableVariants,
  shouldOpenVariantPicker,
  sortCartLinesNewestFirst,
  sortCartLinesOldestFirst,
  withLiveMenuItem,
  type LineDiscountMode,
  type PosCartLine,
} from "../../lib/posCart";
import {
  cartLinesToKotBaseline,
  diffKotLines,
  kotDeltasToCartLines,
  type KotBaselineLine,
} from "../../lib/kotLineDelta";
import {
  formatSessionPrintName,
  printKotDetailed,
  resolveSessionPrintName,
  withPrinterProfile,
  type PrintTicketInput,
} from "../../lib/printTicket";
import { asPrinterName } from "../../lib/asPrinterName";
import { fetchOrgUsers } from "../../api/users";
import {
  BRANCH_PRINT_JOB_DONE_EVENT,
  type BranchPrintJobDoneDetail,
} from "../../lib/branchPrintClient";
import { noticeFromPrintResult } from "../../lib/printNotify";
import { isTerminalAuthorized } from "../../lib/terminalAuth";
import { shareBillViaWhatsApp, phoneFromBillNotes } from "../../lib/whatsappShare";
import { resolveMenuImageUrl } from "../../lib/menuImageUrl";
import { buildPosRecentOrders, canChangePosRecentOrderTable, canPayPosRecentOrder, type PosRecentOrder } from "../../lib/recentOrders";
import {
  cartFromBill,
  cartFromKitchenTicket,
  inferPosModeFromStation,
  packOrderNotesWithDiscount,
  packOrderNotesWithCashReceived,
  packOrderNotesWithKitchenNote,
  parseDeliveryFieldsFromNotes,
  parseKitchenFreeNoteFromNotes,
  parseTicketDiscountFromNotes,
  resolveTicketDeliveryNotes,
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
import { PosCreateAccountModal } from "../../components/PosCreateAccountModal";
import { PosTeamChangeModal } from "../../components/PosTeamChangeModal";
import { PosMyPrintersModal } from "../../components/PosMyPrintersModal";
import { PosCashierModal, type PosCashierMode } from "../../components/PosCashierModal";
import {
  loadPosCustomerDiscountDraft,
  savePosCustomerDiscountDraft,
  clearPosCustomerDiscountDraft,
} from "../../lib/posCustomerDiscountDraft";
import {
  loadPosShiftTeam,
  POS_SHIFT_TEAM_CHANGED_EVENT,
} from "../../lib/posShiftTeam";
import { createStaffFoodRecord, fetchEmployeeAdvances, fetchEmployees } from "../../api/hr";
import { fetchBranchInventory } from "../../api/inventory";
import { openAdvanceTotalsByEmployee } from "../../lib/employeeAdvancesLocal";
import { formatSelectBalance } from "../../lib/selectMeta";
import { SearchableSelect } from "../../ui/SearchableSelect";
import { PosTableTransferPickerModal } from "../../components/PosTableTransferPickerModal";
import { cartToBillLines } from "../../lib/posCheckout";
import { fieldInputClass } from "../../lib/themeClasses";
import {
  DELIVERY_SETTINGS_CHANGED_EVENT,
  loadDeliverySettings,
  type DeliverySettings,
} from "../../lib/deliverySettings";
import {
  effectiveServicePctForMode,
  effectiveTaxPctForMode,
  loadPosSettings,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../../lib/posSettings";
import {
  isTypingTarget,
  matchPosShortcut,
  POS_SHORTCUTS,
} from "../../lib/posShortcuts";
import {
  loadPosHeaderVisible,
  setPosHeaderVisible,
} from "../../lib/posTopExperience";
import {
  DEFAULT_POS_ORDER_MODE_VISIBILITY,
  firstVisiblePosOrderMode,
  isPosOrderModeVisible,
  loadPosOrderModeVisibility,
  POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT,
  type PosOrderModeVisibility,
} from "../../lib/posOrderModeVisibility";
import { ensureOrderSeqAtLeast, nextOrderRef, parseOrderRefSeq, peekNextOrderRef } from "../../lib/orderNumber";
import { ORDER_NUMBER_SETTINGS_CHANGED_EVENT } from "../../lib/orderNumberSettings";
import { loadPrinterSections } from "../../lib/printerSections";
import {
  groupCartLinesBySection,
  resolveKotPrinter,
  resolvePrintUserId,
  resolveReceiptPrinter,
} from "../../lib/printerRouting";
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
const POS_KEYS_BTN =
  "inline-flex shrink-0 items-center justify-center rounded-md border border-slate-600/80 bg-transparent px-2 py-1.5 text-[10px] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white";
const POS_HEADER_TOGGLE_BTN =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-600/80 bg-transparent text-slate-300 transition hover:bg-slate-800 hover:text-white";
const POS_MODE_BAR =
  "no-scrollbar flex shrink-0 gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 ring-1 ring-slate-200 dark:bg-slate-950/80 dark:ring-slate-800/80";
const POS_MODE_BTN = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition ${
    active
      ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20"
      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
  }`;

/** Ticket cart: 3 cols × 2 rows (6 items) visible; scroll when more. */
const POS_CART_COLS = 3;
const POS_CART_VISIBLE_ROWS = 2;
const POS_CART_CARD_ROW_PX = 112;
const POS_CART_LIST_ROW_PX = 52;
const POS_CART_GRID_GAP_PX = 8;
const POS_CART_VISIBLE_COUNT = POS_CART_COLS * POS_CART_VISIBLE_ROWS;
const POS_CART_LIST_VISIBLE_COUNT = 5;
const POS_CART_LIST_MAX_PX =
  POS_CART_CARD_ROW_PX * POS_CART_VISIBLE_ROWS + POS_CART_GRID_GAP_PX * (POS_CART_VISIBLE_ROWS - 1);

function posCartListHeightPx(itemCount: number, layout: "grid" | "list"): number {
  if (itemCount <= 0) return 0;
  if (layout === "list") {
    const rows = Math.min(POS_CART_LIST_VISIBLE_COUNT, itemCount);
    return POS_CART_LIST_ROW_PX * rows + POS_CART_GRID_GAP_PX * Math.max(0, rows - 1);
  }
  const rows = Math.min(POS_CART_VISIBLE_ROWS, Math.ceil(itemCount / POS_CART_COLS));
  return POS_CART_CARD_ROW_PX * rows + POS_CART_GRID_GAP_PX * Math.max(0, rows - 1);
}

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
  const [deliveryCustomerPickerOpen, setDeliveryCustomerPickerOpen] = useState(false);
  const [deliveryCustomerSearch, setDeliveryCustomerSearch] = useState("");
  const [kitchenNote, setKitchenNote] = useState("");
  const [staffFoodConsumerType, setStaffFoodConsumerType] = useState<StaffFoodConsumerType>("staff");
  const [staffFoodEmployeeId, setStaffFoodEmployeeId] = useState("");
  const [staffFoodGuestName, setStaffFoodGuestName] = useState("");
  const [staffFoodPendingName, setStaffFoodPendingName] = useState("");
  const [staffFoodExtraNotes, setStaffFoodExtraNotes] = useState("");
  const [staffFoodExpenseCategory, setStaffFoodExpenseCategory] =
    useState<ExpenseCategory>("Staff Meals");
  const [staffFoodSupplierId, setStaffFoodSupplierId] = useState("");
  const [selectedFloorSectionId, setSelectedFloorSectionId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [menuView, setMenuView] = useState<"all" | "category" | "featured">("all");
  const [fullScreenMenuOpen, setFullScreenMenuOpen] = useState(false);
  const [categoryLayout, setCategoryLayout] = useState<"list" | "icon">(() => {
    try {
      const raw = localStorage.getItem("pops-pos-category-layout");
      return raw === "icon" ? "icon" : "list";
    } catch {
      return "list";
    }
  });
  const [cartLayout, setCartLayout] = useState<"grid" | "list">(() => {
    try {
      const raw = localStorage.getItem("pops-pos-cart-layout");
      return raw === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const [search, setSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<PosCartLine[]>([]);
  /** Which cart card is active — controls whether bill Disc % / Disc Rs is shown. */
  const [selectedCartKey, setSelectedCartKey] = useState<string | null>(null);
  const [variantPickerItem, setVariantPickerItem] = useState<ApiMenuItem | null>(null);
  const [itemPrompt, setItemPrompt] = useState<{
    item: ApiMenuItem;
    variant: MenuItemVariant | null;
  } | null>(null);
  const [discountPctInput, setDiscountPctInput] = useState(0);
  const [discountAmountInput, setDiscountAmountInput] = useState(0);
  const [discountEditedAs, setDiscountEditedAs] = useState<"pct" | "amount">("pct");
  const [posSettings, setPosSettings] = useState<PosSettings>(() => loadPosSettings(undefined));
  const [orderModeVisibility, setOrderModeVisibility] = useState<PosOrderModeVisibility>(
    () => DEFAULT_POS_ORDER_MODE_VISIBILITY,
  );
  const [happyHourSettings, setHappyHourSettings] = useState<HappyHourSettings>(
    () => DEFAULT_HAPPY_HOUR_SETTINGS,
  );
  const [orderRef, setOrderRef] = useState(() => peekNextOrderRef(undefined));
  const [printNotice, setPrintNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [praFiscal, setPraFiscal] = useState<PraFiscalInvoice | null>(null);
  const [praModalOpen, setPraModalOpen] = useState(false);
  const [praPrinting, setPraPrinting] = useState(false);
  const [praModeBusy, setPraModeBusy] = useState(false);
  const [praModePromptOpen, setPraModePromptOpen] = useState(false);
  const pendingPraPayRef = useRef<{
    run: (mode: PraInvoiceMode) => Promise<void>;
    skipPra: () => Promise<void>;
  } | null>(null);
  const taxFeatures = useTaxAuthorityFeatures();
  const organizationId = useSessionStore((s) => s.claims?.organizationId);
  const praFakeEnabled = isPraFakeEnabled(taxFeatures.data);
  const praRealEnabled = isPraRealEnabled(taxFeatures.data);
  const praFeatureActive = praFakeEnabled || praRealEnabled;
  const taxStatusQuery = useQuery({
    queryKey: ["tax-authority", "status", organizationId, branch?.code],
    enabled: Boolean(organizationId && branch?.code && praFeatureActive),
    queryFn: () => fetchTaxAuthorityStatus(branch!.code),
    staleTime: 30_000,
  });
  useEffect(() => {
    const onDone = (ev: Event) => {
      const detail = (ev as CustomEvent<BranchPrintJobDoneDetail>).detail;
      if (!detail) return;
      const order = detail.orderId ? ` ${detail.orderId}` : "";
      setPrintNotice({
        message: detail.ok
          ? `Print ho gaya${order}`
          : `Print failed${order}${detail.error ? ` — ${detail.error}` : ""}`,
        tone: detail.ok ? "success" : "error",
      });
    };
    window.addEventListener(BRANCH_PRINT_JOB_DONE_EVENT, onDone);
    return () => window.removeEventListener(BRANCH_PRINT_JOB_DONE_EVENT, onDone);
  }, []);

  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalMode | null>(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [ticketServicePct, setTicketServicePct] = useState(10);
  const [seatingModalOpen, setSeatingModalOpen] = useState(false);
  const orderTypeModalShown = useSessionStore((s) => s.orderTypeModalShown);
  const markOrderTypeModalShown = useSessionStore((s) => s.markOrderTypeModalShown);
  const seatingModalShown = useSessionStore((s) => s.seatingModalShown);
  const markSeatingModalShown = useSessionStore((s) => s.markSeatingModalShown);
  const sessionUserId = useSessionStore((s) => s.claims?.sub) ?? "pos-local";
  const orgUsersQuery = useQuery({
    queryKey: ["org-users"],
    queryFn: fetchOrgUsers,
    staleTime: 5 * 60_000,
  });
  // Depends on orgUsersQuery.data so label updates after UUID→email cache fills.
  const sessionUserLabel = useMemo(
    () => resolveSessionPrintName(sessionUserId) || "Staff",
    [sessionUserId, orgUsersQuery.data],
  );
  const [orderTypeModalOpen, setOrderTypeModalOpen] = useState(!orderTypeModalShown);
  const [modeConfirmed, setModeConfirmed] = useState(orderTypeModalShown);
  const [editingOrder, setEditingOrder] = useState<PosEditingOrder>(null);
  const [tableTransferTicket, setTableTransferTicket] = useState<ChangeTableTicket | null>(null);
  const [tableTransferPickerOpen, setTableTransferPickerOpen] = useState(false);
  const [payOutModalOpen, setPayOutModalOpen] = useState(false);
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false);
  const [teamChangeModalOpen, setTeamChangeModalOpen] = useState(false);
  const [shiftTeam, setShiftTeam] = useState(() => loadPosShiftTeam(branch?.code));
  const [myPrintersOpen, setMyPrintersOpen] = useState(false);
  const [cashierModal, setCashierModal] = useState<PosCashierMode | null>(null);
  const [headerVisible, setHeaderVisible] = useState(loadPosHeaderVisible);
  /** After Close → Pay succeeds, open Closed + PRA for this bill id. */
  const [closeAfterPayBillId, setCloseAfterPayBillId] = useState<string | null>(null);
  const pendingCloseAfterPayRef = useRef(false);
  const latestOrdersQuickPrintRef = useRef<(() => boolean) | null>(null);
  const cashierPromptShown = useRef(false);
  const seatingAutoOpened = useRef(false);
  const deliveryCustomerFieldRef = useRef<HTMLDivElement>(null);
  const deliveryCustomerInputRef = useRef<HTMLInputElement>(null);
  const customerPanelRef = useRef<HTMLDivElement>(null);
  const deliveryPhoneInputRef = useRef<HTMLInputElement>(null);
  const pendingEditRef = useRef<PosEditLocationState | null>(
    (location.state as PosEditLocationState | null) ?? null,
  );
  /** Lines as loaded when editing a kitchen ticket — used for UPDATE delta KOT. */
  const kotBaselineRef = useRef<KotBaselineLine[] | null>(null);

  const menuQuery = useQuery({
    queryKey: ["menu", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchMenu(branch!.code),
  });

  useEffect(() => {
    setPosSettings(loadPosSettings(branch?.code));
    setHappyHourSettings(loadHappyHourSettings(branch?.code));
    setOrderModeVisibility(loadPosOrderModeVisibility(branch?.code));
    const settings = loadPosSettings(branch?.code);
    setMenuView(settings.menuViewMode === "all" ? "all" : "category");
  }, [branch?.code]);

  useEffect(() => {
    function onOrderModeVisibilityChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setOrderModeVisibility(loadPosOrderModeVisibility(branch?.code));
      }
    }
    window.addEventListener(POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT, onOrderModeVisibilityChanged);
    return () =>
      window.removeEventListener(POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT, onOrderModeVisibilityChanged);
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
    function onPosSettingsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        const next = loadPosSettings(branch?.code);
        setPosSettings(next);
        setMenuView((prev) =>
          prev === "featured" ? prev : next.menuViewMode === "all" ? "all" : "category",
        );
      }
    }
    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
    return () => window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onPosSettingsChanged);
  }, [branch?.code]);

  const taxPct = effectiveTaxPctForMode(posSettings, mode);
  const defaultServicePct = effectiveServicePctForMode(posSettings, mode);

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

  const shiftWaiterId = shiftTeam.waiterId;
  const shiftWaiterName = shiftTeam.waiterName;

  useEffect(() => {
    setShiftTeam(loadPosShiftTeam(branch?.code));
  }, [branch?.code]);

  useEffect(() => {
    const onTeam = () => setShiftTeam(loadPosShiftTeam(branch?.code));
    window.addEventListener(POS_SHIFT_TEAM_CHANGED_EVENT, onTeam);
    return () => window.removeEventListener(POS_SHIFT_TEAM_CHANGED_EVENT, onTeam);
  }, [branch?.code]);

  const ridersQuery = useQuery({
    queryKey: ["delivery-riders", branch?.code],
    enabled: Boolean(branch?.code) && (mode === "delivery" || teamChangeModalOpen),
    queryFn: () => fetchRiders(branch!.code),
  });

  const activeRiders = useMemo(
    () => (ridersQuery.data ?? []).filter((r) => r.active),
    [ridersQuery.data],
  );

  const staffEmployeesQuery = useQuery({
    queryKey: ["hr", "employees", branch?.code],
    enabled: Boolean(branch?.code) && mode === "staff-food",
    queryFn: () => fetchEmployees(branch!.code),
  });

  const staffAdvancesQuery = useQuery({
    queryKey: ["hr", "advances", branch?.code, "open"],
    enabled: Boolean(branch?.code) && mode === "staff-food",
    queryFn: () => fetchEmployeeAdvances(branch!.code, "open"),
  });

  const staffFoodSuppliersQuery = useQuery({
    queryKey: ["inventory", "branch", branch?.code, "staff-food-suppliers"],
    enabled: Boolean(branch?.code) && mode === "staff-food",
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  const activeStaffFoodSuppliers = useMemo(
    () => (staffFoodSuppliersQuery.data?.suppliers ?? []).filter((s) => s.active),
    [staffFoodSuppliersQuery.data],
  );

  const activeStaffEmployees = useMemo(
    () => (staffEmployeesQuery.data ?? []).filter((e) => e.employmentStatus === "active"),
    [staffEmployeesQuery.data],
  );

  const staffOpenAdvanceById = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of staffAdvancesQuery.data ?? []) {
      if (row.openAdvancePkr > 0) map.set(row.employeeId, row.openAdvancePkr);
    }
    if (branch?.code) {
      for (const [employeeId, amount] of openAdvanceTotalsByEmployee(branch.code)) {
        if ((map.get(employeeId) ?? 0) === 0) map.set(employeeId, amount);
      }
    }
    return map;
  }, [staffAdvancesQuery.data, branch?.code]);

  const staffFoodPersonName = useMemo(() => {
    if (staffFoodConsumerType === "guest") return staffFoodGuestName.trim();
    return (
      activeStaffEmployees.find((e) => e.id === staffFoodEmployeeId)?.displayName?.trim() ||
      staffFoodPendingName.trim()
    );
  }, [
    staffFoodConsumerType,
    staffFoodGuestName,
    staffFoodEmployeeId,
    staffFoodPendingName,
    activeStaffEmployees,
  ]);

  useEffect(() => {
    if (mode !== "staff-food" || staffFoodConsumerType !== "staff") return;
    if (staffFoodEmployeeId || !staffFoodPendingName.trim()) return;
    const match = activeStaffEmployees.find(
      (e) => e.displayName.trim().toLowerCase() === staffFoodPendingName.trim().toLowerCase(),
    );
    if (match) {
      setStaffFoodEmployeeId(match.id);
      setStaffFoodPendingName("");
    }
  }, [
    mode,
    staffFoodConsumerType,
    staffFoodEmployeeId,
    staffFoodPendingName,
    activeStaffEmployees,
  ]);

  useEffect(() => {
    if (!posModeShowsCustomerPanel(mode)) setDeliveryDetailsOpen(false);
  }, [mode]);

  const deliveryDetailsSummary = useMemo(() => {
    const parts: string[] = [];
    if (deliveryCustomer.trim()) parts.push(deliveryCustomer.trim());
    if (deliveryPhone.trim()) parts.push(deliveryPhone.trim());
    if (mode === "delivery") {
      if (deliveryAddress.trim()) parts.push(deliveryAddress.trim());
      if (deliveryRiderId) {
        const rider = activeRiders.find((r) => r.id === deliveryRiderId);
        parts.push(rider?.name ?? "Rider");
      }
      if (deliveryChargePkr > 0) parts.push(String(deliveryChargePkr));
    }
    if (parts.length > 0) return parts.join(" · ");
    return mode === "delivery" ? "Tap to enter delivery details" : "Tap to enter customer details";
  }, [
    mode,
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

  useEffect(() => {
    if (!branch?.code) return;
    const maxByMode = new Map<string, number>();
    let maxShared = 0;
    for (const ticket of kitchenQuery.data ?? []) {
      const n = parseOrderRefSeq(ticket.orderRef);
      if (n == null) continue;
      const ticketMode = inferPosModeFromStation(ticket.stationLabel ?? "");
      maxByMode.set(ticketMode, Math.max(maxByMode.get(ticketMode) ?? 0, n));
      maxShared = Math.max(maxShared, n);
    }
    for (const bill of ordersQuery.data ?? []) {
      const n = parseOrderRefSeq(bill.orderRef) ?? parseOrderRefSeq(bill.billRef);
      if (n == null) continue;
      const billMode = inferPosModeFromStation(bill.tableLabel ?? "");
      maxByMode.set(billMode, Math.max(maxByMode.get(billMode) ?? 0, n));
      maxShared = Math.max(maxShared, n);
    }
    if (maxShared > 0) ensureOrderSeqAtLeast(branch.code, maxShared);
    for (const [modeKey, seq] of maxByMode) {
      if (seq > 0) ensureOrderSeqAtLeast(branch.code, seq, modeKey as PosOrderMode);
    }
    if (!editingOrder) setOrderRef(peekNextOrderRef(branch.code, mode));
  }, [branch?.code, kitchenQuery.data, ordersQuery.data, editingOrder, mode]);

  useEffect(() => {
    function onNumberingChanged(): void {
      if (!editingOrder) setOrderRef(peekNextOrderRef(branch?.code, mode));
    }
    window.addEventListener(ORDER_NUMBER_SETTINGS_CHANGED_EVENT, onNumberingChanged);
    return () => window.removeEventListener(ORDER_NUMBER_SETTINGS_CHANGED_EVENT, onNumberingChanged);
  }, [branch?.code, mode, editingOrder]);

  const customerInvoicesQuery = useQuery({
    queryKey: ["accounting", "receivable", branch?.code],
    enabled: Boolean(branch?.code) && (deliveryCustomerPickerOpen || deliveryDetailsOpen),
    queryFn: () => fetchCustomerInvoices(branch!.code),
  });

  const knownDeliveryCustomers = useMemo(() => {
    const seen = new Map<string, { name: string; phone: string; address: string }>();
    for (const invoice of customerInvoicesQuery.data ?? []) {
      const key = (invoice.customerPhone || invoice.customerName).trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.set(key, { name: invoice.customerName, phone: invoice.customerPhone ?? "", address: "" });
    }
    for (const bill of ordersQuery.data ?? []) {
      const parsed = parseDeliveryFieldsFromNotes(bill.notes);
      if (!parsed.customer && !parsed.phone) continue;
      const key = (parsed.phone || parsed.customer).trim().toLowerCase();
      if (!key) continue;
      const existing = seen.get(key);
      if (existing) {
        if (!existing.address && parsed.address) existing.address = parsed.address;
        continue;
      }
      seen.set(key, {
        name: parsed.customer || "Unnamed customer",
        phone: parsed.phone,
        address: parsed.address,
      });
    }
    return [...seen.values()].slice(0, 50);
  }, [customerInvoicesQuery.data, ordersQuery.data]);

  const filteredDeliveryCustomers = useMemo(() => {
    const q = deliveryCustomerSearch.trim().toLowerCase();
    if (!q) return knownDeliveryCustomers;
    return knownDeliveryCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [knownDeliveryCustomers, deliveryCustomerSearch]);

  function handleDeliveryCustomerChange(value: string): void {
    setDeliveryCustomer(value);
    const triggerIndex = Math.max(value.lastIndexOf("*"), value.lastIndexOf("#"));
    if (triggerIndex !== -1) {
      setDeliveryCustomerPickerOpen(true);
      setDeliveryCustomerSearch(value.slice(triggerIndex + 1));
      return;
    }
    if (deliveryCustomerPickerOpen) {
      setDeliveryCustomerSearch(value);
    }
  }

  function selectKnownDeliveryCustomer(customer: { name: string; phone: string; address: string }): void {
    setDeliveryCustomer(customer.name);
    if (customer.phone) setDeliveryPhone(customer.phone);
    if (customer.address) setDeliveryAddress(customer.address);
    setDeliveryCustomerPickerOpen(false);
    setDeliveryCustomerSearch("");
  }

  useEffect(() => {
    if (!deliveryCustomerPickerOpen) return;
    function onDocMouseDown(e: MouseEvent): void {
      if (deliveryCustomerFieldRef.current && !deliveryCustomerFieldRef.current.contains(e.target as Node)) {
        setDeliveryCustomerPickerOpen(false);
      }
    }
    window.addEventListener("mousedown", onDocMouseDown);
    return () => window.removeEventListener("mousedown", onDocMouseDown);
  }, [deliveryCustomerPickerOpen]);

  const cashSessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
    refetchInterval: 30_000,
  });

  // Soft-clear day-close pause flag for this device (never show blocking banner).
  useEffect(() => {
    if (!branch?.code) return;
    void fetchClosingStatus(branch.code);
  }, [branch?.code]);

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
  const terminalBlocked = Boolean(branch?.code) && !isTerminalAuthorized(branch?.code);
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

  const occupiedTableNumbers = useMemo(() => {
    const set = new Set<string>();
    for (const ticket of kitchenQuery.data ?? []) {
      if (ticket.status === "done") continue;
      if (editingOrder?.kind === "ticket" && ticket.id === editingOrder.ticketId) continue;
      const tableNumber = tableNumberFromStation(ticket.stationLabel);
      if (tableNumber) set.add(tableNumber.trim().toUpperCase());
    }
    for (const bill of ordersQuery.data ?? []) {
      if (bill.status !== "held") continue;
      if (editingOrder?.kind === "held-bill" && bill.id === editingOrder.billId) continue;
      const tableNumber = tableNumberFromStation(bill.tableLabel);
      if (tableNumber) set.add(tableNumber.trim().toUpperCase());
    }
    return set;
  }, [kitchenQuery.data, ordersQuery.data, editingOrder]);

  const visiblePosOrderModes = useMemo(
    () => POS_ORDER_MODES.filter((m) => isPosOrderModeVisible(m.id, orderModeVisibility)),
    [orderModeVisibility],
  );

  useEffect(() => {
    if (!visiblePosOrderModes.some((m) => m.id === mode)) {
      setMode(firstVisiblePosOrderMode(orderModeVisibility));
    }
  }, [visiblePosOrderModes, mode, orderModeVisibility]);

  function switchMode(nextMode: PosOrderMode): void {
    if (nextMode === "staff-food" && editingOrder) {
      setEditingOrder(null);
      setCart([]);
      kotBaselineRef.current = null;
      setDiscountPctInput(0);
      setDiscountAmountInput(0);
      setDiscountEditedAs("pct");
    }
    setMode(nextMode);
    if (!editingOrder) {
      setOrderRef(peekNextOrderRef(branch?.code, nextMode));
    }
    if (posModeShowsCustomerPanel(nextMode)) {
      setDeliveryDetailsOpen(true);
      // Restore Apply draft only while the same open ticket still has cart lines —
      // never paste last order's customer onto a blank new order.
      if (!editingOrder && branch?.code && cart.length > 0) {
        const draft = loadPosCustomerDiscountDraft(branch.code);
        if (
          draft &&
          (draft.mode === nextMode ||
            nextMode === "takeaway" ||
            nextMode === "delivery" ||
            nextMode === "online" ||
            nextMode === "foodpanda")
        ) {
          if (!deliveryCustomer.trim() && draft.customer) setDeliveryCustomer(draft.customer);
          if (!deliveryPhone.trim() && draft.phone) setDeliveryPhone(draft.phone);
          if (nextMode === "delivery" && !deliveryAddress.trim() && draft.address) {
            setDeliveryAddress(draft.address);
          }
          if (!autoDiscountEnabled && discountPctInput === 0 && discountAmountInput === 0) {
            if (draft.discountPctInput > 0 || draft.discountAmountInput > 0) {
              setDiscountEditedAs(draft.discountEditedAs);
              setDiscountPctInput(draft.discountPctInput);
              setDiscountAmountInput(draft.discountAmountInput);
            }
          }
        }
      }
    }
    if (nextMode === "delivery" && !deliveryRiderId && shiftTeam.riderId) {
      setDeliveryRiderId(shiftTeam.riderId);
    }
  }

  function beginNextOrderCycle(): void {
    switchMode("dine-in");
    setSelectedFloorSectionId(null);
    setSelectedTableId(null);
    setSeatingModalOpen(false);
    seatingAutoOpened.current = false;
    if (orderTypeModalShown) {
      // "Select order type" only shows once per app run — later orders default to dine-in;
      // staff switch modes via the always-visible tab bar instead.
      setModeConfirmed(true);
      setOrderTypeModalOpen(false);
    } else {
      setModeConfirmed(false);
      setOrderTypeModalOpen(true);
    }
  }

  function confirmOrderType(nextMode: PosOrderMode): void {
    switchMode(nextMode);
    setModeConfirmed(true);
    setOrderTypeModalOpen(false);
    markOrderTypeModalShown();
    if (nextMode === "dine-in") {
      if (floorSections.length > 0 && !seatingModalShown) {
        setSeatingModalOpen(true);
        seatingAutoOpened.current = true;
      }
      return;
    }
    setSelectedFloorSectionId(null);
    setSelectedTableId(null);
    setSeatingModalOpen(false);
    seatingAutoOpened.current = false;
  }

  function dismissOrderTypeModal(): void {
    setOrderTypeModalOpen(false);
    markOrderTypeModalShown();
    if (!modeConfirmed) {
      setModeConfirmed(true);
      if (mode === "dine-in" && floorSections.length > 0 && !selectedTableId && !seatingModalShown) {
        setSeatingModalOpen(true);
        seatingAutoOpened.current = true;
      }
    }
  }

  useEffect(() => {
    if (!modeConfirmed || mode !== "dine-in") {
      if (mode !== "dine-in") {
        setSelectedFloorSectionId(null);
        setSelectedTableId(null);
        setSeatingModalOpen(false);
        seatingAutoOpened.current = false;
      }
      return;
    }
    if (seatingModalShown) return;
    if (floorSections.length > 0 && !selectedTableId && !seatingAutoOpened.current) {
      setSeatingModalOpen(true);
      seatingAutoOpened.current = true;
    }
  }, [mode, modeConfirmed, floorSections.length, selectedTableId, seatingModalShown]);

  useEffect(() => {
    if (!selectedTableId) return;
    const table = floorTables.find((t) => t.id === selectedTableId);
    if (!table) return;
    setSelectedFloorSectionId((prev) => (prev !== table.sectionId ? table.sectionId : prev));
  }, [selectedTableId, floorTables]);

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
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [
    menuItems,
    activeCategoryId,
    searchQuery,
    isSearching,
    showFeaturedOnly,
    showAllItems,
    categoryById,
  ]);

  const searchDropdownItems = useMemo(() => filteredMenu.slice(0, 8), [filteredMenu]);

  useEffect(() => {
    setSearchHighlight(0);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchDropdownOpen) return;
    function onClickOutside(e: MouseEvent): void {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [searchDropdownOpen]);

  function addVariantToCart(
    item: ApiMenuItem,
    variant: MenuItemVariant | null,
    opts?: { qty?: number; unitPrice?: number; lineNote?: string },
  ): void {
    const qty = opts?.qty ?? 1;
    const unitPrice = opts?.unitPrice;
    const lineNote = opts?.lineNote?.trim();
    setCart((prev) => {
      const sortOrder = nextCartSortOrder(prev);
      const line = buildCartLine(item, variant, qty, sortOrder, unitPrice, lineNote);
      // Open-price / custom qty / noted lines should not silently merge with catalog lines.
      const canMerge = unitPrice == null && qty === 1 && !lineNote;
      const i = canMerge ? prev.findIndex((l) => l.key === line.key) : -1;
      if (i >= 0) {
        const key = line.key;
        setSelectedCartKey(key);
        // Keep existing cart position when quantity increases on an already-added line.
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      }
      setSelectedCartKey(line.key);
      return [line, ...prev];
    });
  }

  function beginAddToCart(item: ApiMenuItem, variant: MenuItemVariant | null): void {
    if (itemNeedsPosPrompt(item)) {
      setItemPrompt({ item, variant });
      return;
    }
    addVariantToCart(item, variant);
  }

  function onDishClick(item: ApiMenuItem): void {
    if (shouldOpenVariantPicker(item)) {
      setVariantPickerItem(item);
      return;
    }
    beginAddToCart(item, pickDefaultVariant(item));
  }

  function setLineDiscount(
    lineKey: string,
    mode: LineDiscountMode,
    value: number,
  ): void {
    setCart((prev) =>
      prev.map((l) =>
        l.key === lineKey
          ? {
              ...l,
              lineDiscountMode: mode,
              lineDiscountValue: Math.max(0, value),
            }
          : l,
      ),
    );
  }

  function selectSearchDropdownItem(item: ApiMenuItem): void {
    onDishClick(item);
    setSearch("");
    setSearchDropdownOpen(false);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!isSearching || searchDropdownItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchDropdownOpen(true);
      setSearchHighlight((i) => Math.min(searchDropdownItems.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchDropdownOpen(true);
      setSearchHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (!searchDropdownOpen) return;
      e.preventDefault();
      const item = searchDropdownItems[searchHighlight];
      if (item) selectSearchDropdownItem(item);
    } else if (e.key === "Escape") {
      setSearchDropdownOpen(false);
    }
    // ArrowLeft / ArrowRight are left untouched so the text cursor still moves within the input.
  }

  function setQty(lineKey: string, qty: number): void {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((l) => l.key !== lineKey);
      // Keep cart position fixed — only +/- quantity, do not bump sortOrder.
      return prev.map((l) => (l.key === lineKey ? { ...l, qty } : l));
    });
  }

  const menuById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems]);

  const effectiveCart = useMemo(() => {
    const withBonus = applyHappyHourBonus(cart, menuItems, happyHourSettings);
    // Always use latest menu flags so Non-discountable / Non-taxable apply to every line.
    return withBonus.map((line) => withLiveMenuItem(line, menuById));
  }, [cart, menuItems, happyHourSettings, menuById]);

  const displayCart = useMemo(
    () => sortCartLinesNewestFirst(effectiveCart),
    [effectiveCart],
  );

  const cartListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (displayCart.length === 0) {
      setSelectedCartKey(null);
      return;
    }
    if (!selectedCartKey || !displayCart.some((l) => l.key === selectedCartKey)) {
      setSelectedCartKey(displayCart[0].key);
    }
  }, [displayCart, selectedCartKey]);

  useEffect(() => {
    if (displayCart.length === 0) return;
    const el = cartListRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, [displayCart[0]?.key, displayCart[0]?.sortOrder, displayCart[0]?.qty]);

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

  const subtotal = effectiveCart.reduce((s, l) => s + cartLineNet(l), 0);

  const itemEligibility = useMemo(() => {
    const discountableSubtotal = effectiveCart.reduce((s, l) => {
      // Non-taxable / non-discountable lines never absorb bill discount.
      if (lineBlocksBillDiscount(l)) return s;
      return s + cartLineNet(l);
    }, 0);
    const taxableSubtotal = effectiveCart.reduce((s, l) => {
      if (l.item.nonTaxable) return s;
      return s + cartLineNet(l);
    }, 0);
    return { discountableSubtotal, taxableSubtotal };
  }, [effectiveCart]);

  const selectedCartLine = useMemo(
    () => displayCart.find((l) => l.key === selectedCartKey) ?? displayCart[0] ?? null,
    [displayCart, selectedCartKey],
  );

  // Disc panel follows the clicked cart card (every item, not just the first).
  const showTicketDiscount = Boolean(
    selectedCartLine &&
      !lineBlocksBillDiscount(selectedCartLine) &&
      itemEligibility.discountableSubtotal > 0,
  );
  // Tax row only when tax is enabled in Settings and cart has taxable lines.
  const showTaxRow = posSettings.taxEnabled && taxPct > 0 && itemEligibility.taxableSubtotal > 0;

  const autoDiscountEnabled = posSettings.autoDiscountEnabled;
  const autoDiscountPct = posSettings.autoDiscountPct;
  const autoDiscountAmount = useMemo(() => {
    if (!autoDiscountEnabled || itemEligibility.discountableSubtotal <= 0) return 0;
    return discountAmountFromPct(autoDiscountPct, itemEligibility.discountableSubtotal);
  }, [autoDiscountEnabled, autoDiscountPct, itemEligibility.discountableSubtotal]);

  useEffect(() => {
    if (autoDiscountEnabled) {
      // Keep manual inputs in sync with the automatic discount for display/checkout.
      setDiscountEditedAs("pct");
      setDiscountPctInput(autoDiscountPct);
      setDiscountAmountInput(autoDiscountAmount);
      return;
    }
    // Do NOT wipe restored/manual discount when the selected line hides the disc panel
    // (e.g. non-discountable item selected) — totals already skip disc when !showTicketDiscount.
    if (!showTicketDiscount) return;
    setDiscountAmountInput((prev) => clampDiscountPkr(prev, itemEligibility.discountableSubtotal));
  }, [
    autoDiscountEnabled,
    autoDiscountPct,
    autoDiscountAmount,
    itemEligibility.discountableSubtotal,
    showTicketDiscount,
    selectedCartKey,
  ]);

  const ticketTotals = useMemo(() => {
    let discountSeed = 0;
    if (autoDiscountEnabled) {
      discountSeed = autoDiscountAmount;
    } else if (showTicketDiscount) {
      discountSeed =
        discountEditedAs === "pct"
          ? discountAmountFromPct(discountPctInput, itemEligibility.discountableSubtotal)
          : clampDiscountPkr(discountAmountInput, itemEligibility.discountableSubtotal);
    }
    const charge = mode === "delivery" ? deliveryChargePkr : 0;
    return computeTicketTotals(subtotal, discountSeed, ticketServicePct, taxPct, charge, itemEligibility);
  }, [
    subtotal,
    discountPctInput,
    discountAmountInput,
    discountEditedAs,
    ticketServicePct,
    taxPct,
    mode,
    deliveryChargePkr,
    itemEligibility,
    showTicketDiscount,
    autoDiscountEnabled,
    autoDiscountAmount,
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
    const base = itemEligibility.discountableSubtotal;
    setDiscountEditedAs("pct");
    setDiscountPctInput(pct);
    setDiscountAmountInput(discountAmountFromPct(pct, base));
  }

  function onDiscountAmountChange(raw: number): void {
    const base = itemEligibility.discountableSubtotal;
    const amount = clampDiscountPkr(raw, base);
    setDiscountEditedAs("amount");
    setDiscountAmountInput(amount);
    setDiscountPctInput(discountPctFromAmount(amount, base));
  }

  const modeLabel = posOrderModeLabel(mode);
  const selectedRiderName =
    mode === "delivery" && deliveryRiderId
      ? activeRiders.find((r) => r.id === deliveryRiderId)?.name?.trim() || ""
      : "";
  const orderNotes =
    mode === "delivery"
      ? posDeliveryNotes(deliveryCustomer, deliveryPhone, deliveryAddress, selectedRiderName)
      : mode === "takeaway"
        ? posCustomerOrderNotes("Takeaway", deliveryCustomer, deliveryPhone)
        : mode === "dine-in"
          ? posCustomerOrderNotes("Dine-in", deliveryCustomer, deliveryPhone)
          : mode === "online"
            ? posCustomerOrderNotes("Online", deliveryCustomer, deliveryPhone)
            : mode === "foodpanda"
              ? posCustomerOrderNotes("Foodpanda", deliveryCustomer, deliveryPhone)
              : mode === "staff-food"
                ? posStaffFoodNotes(staffFoodConsumerType, staffFoodPersonName, staffFoodExtraNotes)
                : undefined;

  /** Customer + optional kitchen instruction (no Disc markers). */
  const notesWithKitchen = packOrderNotesWithKitchenNote(orderNotes, kitchenNote);

  /** Kitchen notes include DiscPct/DiscRs so Edit restores DISC % / DISC RS. */
  const kitchenOrderNotes = packOrderNotesWithDiscount(
    notesWithKitchen,
    !autoDiscountEnabled && (discountPctInput > 0 || discountAmountInput > 0)
      ? {
          editedAs: discountEditedAs,
          pct: discountPctInput,
          amount: discountAmountInput,
        }
      : null,
  );
  const stationLabel = posStationLabel(mode, tableLabel, staffFoodPersonName, staffFoodConsumerType);
  const billTableLabel = posBillTableLabel(
    mode,
    tableLabel,
    staffFoodPersonName,
    staffFoodConsumerType,
  );

  /** Print / kitchen payload: oldest first so the last-added item is at the bottom. */
  const printOrderedCart = () => sortCartLinesOldestFirst(effectiveCart);

  function buildPrintPayload(): Omit<PrintTicketInput, "kind"> {
    const lines = printOrderedCart();
    const staffName = formatSessionPrintName(useSessionStore.getState().claims?.sub) || sessionUserLabel;
    return {
      branchName: branch?.name ?? "POPS",
      branchCode: branch?.code ?? "—",
      orderRef,
      modeLabel,
      tableLabel: posPrintTableLabel(mode, tableLabel, staffFoodPersonName, staffFoodConsumerType),
      notes: notesWithKitchen,
      customerName: deliveryCustomer.trim() || undefined,
      customerPhone: deliveryPhone.trim() || undefined,
      customerAddress: mode === "delivery" ? deliveryAddress.trim() || undefined : undefined,
      riderName: selectedRiderName || undefined,
      waiterName:
        mode === "staff-food" && staffFoodPersonName
          ? staffFoodPersonName
          : shiftWaiterName || staffName || "POS Counter",
      lines: lines.map((line) => ({
        label: cartLinePrintLabel(line),
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
    printOrderedCart().map((line) => ({
      label: cartLinePrintLabel({
        lineLabel:
          line.lineLabel?.trim() ||
          formatMenuItemPrintLabel({
            name: line.item.name,
            secondaryName: line.item.secondaryName,
            portion: line.item.portion,
            variantLabel: line.variant?.label ?? null,
            simplePrice: line.item.simplePrice,
          }),
        lineNote: line.lineNote,
      }),
      qty: line.qty,
      unitPrice: line.unitPrice,
      // Only attach real catalog ids — orphan edit lines must not send fake UUIDs.
      ...(menuById.has(line.item.id) ? { menuItemId: line.item.id } : {}),
    }));

  function invalidateOrderFeeds(): void {
    void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  function resetStaffFoodFields(): void {
    setStaffFoodConsumerType("staff");
    setStaffFoodEmployeeId("");
    setStaffFoodGuestName("");
    setStaffFoodPendingName("");
    setStaffFoodExtraNotes("");
    setStaffFoodExpenseCategory("Staff Meals");
    setStaffFoodSupplierId("");
  }

  function resetAfterKitchenOrder(): void {
    setOrderRef(peekNextOrderRef(branch?.code, mode));
    setCart([]);
    kotBaselineRef.current = null;
    setDeliveryCustomer("");
    setDeliveryPhone("");
    setDeliveryAddress("");
    setDeliveryRiderId("");
    setDeliveryChargePkr(loadDeliverySettings(branch?.code).defaultChargePkr);
    setDeliveryDetailsOpen(false);
    resetStaffFoodFields();
    setKitchenNote("");
    // Do not carry last customer/discount into the next new order.
    clearPosCustomerDiscountDraft(branch?.code);
    beginNextOrderCycle();
  }

  async function persistStaffFoodRecord(): Promise<void> {
    if (mode !== "staff-food" || !branch?.code || !staffFoodPersonName) return;
    const itemsOrdered = effectiveCart
      .map((line) => `${line.lineLabel} x${line.qty}`)
      .join(", ")
      .slice(0, 1000);
    if (!itemsOrdered) return;
    try {
      await createStaffFoodRecord({
        branchCode: branch.code,
        consumerType: staffFoodConsumerType,
        employeeId: staffFoodConsumerType === "staff" ? staffFoodEmployeeId || undefined : undefined,
        supplierId: staffFoodSupplierId || undefined,
        expenseCategory: staffFoodExpenseCategory,
        personName: staffFoodPersonName,
        mealDate: new Date().toISOString().slice(0, 10),
        itemsOrdered,
        amountPkr: Math.max(0, Math.round(total)),
        notes: staffFoodExtraNotes.trim() || undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ["hr", "staff-food"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting", "expenses"] });
    } catch {
      // Order already succeeded — don't block POS on HR log failure.
    }
  }

  function resetAfterBill(): void {
    setEditingOrder(null);
    setDiscountPctInput(0);
    setDiscountAmountInput(0);
    setDiscountEditedAs("pct");
    resetAfterKitchenOrder();
  }

  function applyTableFromStation(stationLabelValue: string): void {
    const tableNumber = tableNumberFromStation(stationLabelValue);
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

  function applyStaffFoodFromStation(stationLabelValue: string): void {
    const parsed = parseStaffFoodPersonFromStation(stationLabelValue);
    if (!parsed) {
      resetStaffFoodFields();
      return;
    }
    setStaffFoodConsumerType(parsed.consumerType);
    setStaffFoodExtraNotes("");
    if (parsed.consumerType === "guest") {
      setStaffFoodEmployeeId("");
      setStaffFoodPendingName("");
      setStaffFoodGuestName(parsed.personName);
      return;
    }
    setStaffFoodGuestName("");
    const match = activeStaffEmployees.find(
      (e) => e.displayName.trim().toLowerCase() === parsed.personName.toLowerCase(),
    );
    setStaffFoodEmployeeId(match?.id ?? "");
    setStaffFoodPendingName(match ? "" : parsed.personName);
  }

  function applyTicketToPos(ticket: KitchenTicket): void {
    setOrderTypeModalOpen(false);
    setModeConfirmed(true);
    setEditingOrder({ kind: "ticket", ticketId: ticket.id });
    setOrderRef(ticket.orderRef ?? ticket.ticketRef);
    setMode(inferPosModeFromStation(ticket.stationLabel));
    const loaded = stripComplimentaryLines(cartFromKitchenTicket(menuItems, ticket));
    setCart(loaded);
    kotBaselineRef.current = cartLinesToKotBaseline(loaded);
    const ticketNotes = resolveTicketDeliveryNotes(ticket) ?? ticket.notes ?? null;
    const savedDiscount = parseTicketDiscountFromNotes(ticketNotes);
    if (savedDiscount) {
      setDiscountEditedAs(savedDiscount.editedAs);
      setDiscountPctInput(savedDiscount.pct);
      setDiscountAmountInput(savedDiscount.amount);
    } else {
      setDiscountPctInput(0);
      setDiscountAmountInput(0);
      setDiscountEditedAs("pct");
    }
    setDeliveryRiderId(ticket.riderId ?? "");
    setDeliveryChargePkr(ticket.deliveryChargePkr ?? 0);
    applyStaffFoodFromStation(ticket.stationLabel);
    const delivery = parseDeliveryFieldsFromNotes(ticketNotes);
    setDeliveryCustomer(delivery.customer);
    setDeliveryPhone(delivery.phone);
    setDeliveryAddress(delivery.address);
    setKitchenNote(parseKitchenFreeNoteFromNotes(ticketNotes));
    applyTableFromStation(ticket.stationLabel);
    const loadedMode = inferPosModeFromStation(ticket.stationLabel);
    if (
      loadedMode === "delivery" ||
      loadedMode === "takeaway" ||
      loadedMode === "online" ||
      loadedMode === "foodpanda" ||
      delivery.customer ||
      delivery.phone
    ) {
      setDeliveryDetailsOpen(true);
    }
    setPrintNotice({ message: `Editing ${ticket.orderRef ?? ticket.ticketRef}. Add or remove items, then update.`, tone: "success" });
  }

  function applyBillToPos(bill: Bill): void {
    setOrderTypeModalOpen(false);
    setModeConfirmed(true);
    setEditingOrder({ kind: "held-bill", billId: bill.id });
    setOrderRef(bill.orderRef ?? bill.billRef);
    setMode(inferPosModeFromStation(bill.tableLabel));
    setCart(stripComplimentaryLines(cartFromBill(menuItems, bill)));
    setTicketServicePct(bill.servicePct);
    setDiscountAmountInput(bill.discount);
    setDiscountPctInput(bill.subtotal > 0 ? Math.round((bill.discount / bill.subtotal) * 100) : 0);
    setDiscountEditedAs("amount");
    const noteDisc = parseTicketDiscountFromNotes(bill.notes);
    if ((!bill.discount || bill.discount <= 0) && noteDisc) {
      setDiscountEditedAs(noteDisc.editedAs);
      setDiscountPctInput(noteDisc.pct);
      setDiscountAmountInput(noteDisc.amount);
    }
    setDeliveryRiderId(bill.riderId ?? "");
    setDeliveryChargePkr(bill.deliveryChargePkr ?? 0);
    applyStaffFoodFromStation(bill.tableLabel);
    const delivery = parseDeliveryFieldsFromNotes(bill.notes);
    setDeliveryCustomer(delivery.customer);
    setDeliveryPhone(delivery.phone);
    setDeliveryAddress(delivery.address);
    setKitchenNote(parseKitchenFreeNoteFromNotes(bill.notes));
    applyTableFromStation(bill.tableLabel);
    const loadedMode = inferPosModeFromStation(bill.tableLabel);
    if (
      loadedMode === "delivery" ||
      loadedMode === "takeaway" ||
      loadedMode === "online" ||
      loadedMode === "foodpanda" ||
      delivery.customer ||
      delivery.phone
    ) {
      setDeliveryDetailsOpen(true);
    }
    setPrintNotice({ message: `Editing held bill ${bill.orderRef ?? bill.billRef}.`, tone: "success" });
  }

  function loadRecentOrderForEdit(order: PosRecentOrder): void {
    if (order.kind === "pending" && order.kitchenTicket) {
      if (order.kitchenTicket.status === "done") {
        setPrintNotice({
          message: "This order is finalized — editing is locked.",
          tone: "error",
        });
        return;
      }
      const fresh =
        (kitchenQuery.data ?? []).find((row) => row.id === order.kitchenTicket!.id) ??
        order.kitchenTicket;
      if (menuItems.length === 0) {
        pendingEditRef.current = { editTicketId: fresh.id };
        setPrintNotice({ message: "Loading menu to open order for edit…", tone: "success" });
        return;
      }
      applyTicketToPos(fresh);
      return;
    }
    if (order.bill?.status === "held") {
      if (menuItems.length === 0) {
        pendingEditRef.current = { editBillId: order.bill.id };
        setPrintNotice({ message: "Loading menu to open held bill for edit…", tone: "success" });
        return;
      }
      applyBillToPos(order.bill);
      return;
    }
    setPrintNotice({
      message: "This order cannot be edited. Use Print for kitchen ticket or Close to finalize.",
      tone: "error",
    });
  }

  function loadRecentOrderForPayment(
    order: PosRecentOrder,
    options?: { thenClose?: boolean },
  ): void {
    pendingCloseAfterPayRef.current = Boolean(options?.thenClose);
    if (!canPayPosRecentOrder(order)) {
      setPrintNotice({ message: "This order is already paid.", tone: "error" });
      pendingCloseAfterPayRef.current = false;
      return;
    }
    if (order.kind === "pending" && order.kitchenTicket) {
      const fresh =
        (kitchenQuery.data ?? []).find((row) => row.id === order.kitchenTicket!.id) ??
        order.kitchenTicket;
      if (menuItems.length === 0) {
        pendingEditRef.current = { editTicketId: fresh.id };
        setCheckoutModal("pay");
        setPrintNotice({ message: "Loading menu for payment…", tone: "success" });
        return;
      }
      applyTicketToPos(fresh);
      setCheckoutModal("pay");
      return;
    }
    if (order.bill?.status === "held") {
      if (menuItems.length === 0) {
        pendingEditRef.current = { editBillId: order.bill.id };
        setCheckoutModal("pay");
        return;
      }
      applyBillToPos(order.bill);
      setCheckoutModal("pay");
    }
  }

  function cancelEditing(): void {
    resetAfterBill();
    setPrintNotice({ message: "Edit cancelled.", tone: "success" });
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
      setPrintNotice({ message: "No active dine-in orders available for table transfer.", tone: "error" });
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

  function validateStaffFoodPerson(): string | null {
    if (mode !== "staff-food") return null;
    if (staffFoodConsumerType === "staff") {
      if (!staffFoodEmployeeId) return "Select which staff member took the food.";
      return null;
    }
    if (!staffFoodGuestName.trim()) return "Enter the guest name for staff food.";
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
    const staffErr = validateStaffFoodPerson();
    if (staffErr) return staffErr;
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
    const staffErr = validateStaffFoodPerson();
    if (staffErr) return staffErr;
    return null;
  }

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const err = validateKitchenOrder();
      if (err) throw new Error(err);
      if (editingOrder?.kind === "ticket") {
        try {
          // Prefer the ticket's live station after Table Transfer so Update does not
          // rewrite the order back onto the old table (stale seating UI).
          const liveTicket = (kitchenQuery.data ?? []).find(
            (row) => row.id === editingOrder.ticketId,
          );
          const effectiveStation = liveTicket?.stationLabel?.trim() || stationLabel;
          return await updateKitchenTicket(editingOrder.ticketId, {
            stationLabel: effectiveStation,
            lines: kitchenLines(),
            notes: kitchenOrderNotes ?? null,
            ...deliveryExtras(),
          });
        } catch (updateErr) {
          // Stale / closed / offline ticket — create a fresh KOT so Print/Update still works.
          if (!isKitchenTicketMissingError(updateErr)) throw updateErr;
          return createKitchenTicket({
            branchCode: branch!.code,
            orderRef: orderRef || nextOrderRef(branch!.code, mode),
            stationLabel,
            lines: kitchenLines(),
            notes: kitchenOrderNotes,
            ...deliveryExtras(),
          });
        }
      }
      return createKitchenTicket({
        branchCode: branch!.code,
        // Use the reserved on-screen order # (already peeked). Do not call nextOrderRef
        // again — that skipped the displayed ref and caused paid/new ORD mix-ups.
        orderRef: (() => {
          const reserved = orderRef.trim();
          if (reserved) {
            const seq = parseOrderRefSeq(reserved);
            if (seq) ensureOrderSeqAtLeast(branch!.code, seq, mode);
            return reserved;
          }
          return nextOrderRef(branch!.code, mode);
        })(),
        stationLabel,
        lines: kitchenLines(),
        notes: kitchenOrderNotes,
        ...deliveryExtras(),
      });
    },
    onSuccess: async (ticket) => {
      const wasTicketEdit = editingOrder?.kind === "ticket";
      // Always silent-print to assigned OS printers (never force Windows dialog / PDF).
      const printed = await printKitchenKotsOnPay(ticket.orderRef ?? orderRef);
      const kotOk = printed.errors.length === 0;
      const printErrors = printed.errors;
      if (!wasTicketEdit) {
        await persistStaffFoodRecord();
      }
      invalidateOrderFeeds();
      // Always clear the ticket panel after Order / Update / Print order.
      setEditingOrder(null);
      resetAfterKitchenOrder();
      if (printed.skippedNoChanges) {
        setPrintNotice({
          tone: "success",
          message: `${modeLabel} order updated (no item changes — kitchen not reprinted).`,
        });
      } else if (kotOk) {
        setPrintNotice(
          noticeFromPrintResult(
            true,
            wasTicketEdit
              ? `${modeLabel} order updated — kitchen got UPDATE REVISED (changed items only).`
              : `${modeLabel} order saved and sent to kitchen.`,
          ),
        );
      } else {
        setPrintNotice({
          tone: "error",
          message: `Order ${wasTicketEdit ? "updated" : "saved"}, but KOT print failed — ${printErrors.join("; ")}. Open POS → My printers, or Printer → All Printers / Printer by Section, and link a real OS printer.`,
        });
      }
    },
    onError: (err: Error) => setPrintNotice({ message: err.message, tone: "error" }),
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
        notes: kitchenOrderNotes ?? null,
        discountPkr: discount,
        servicePct: ticketServicePct,
        taxPct,
        riderId: deliveryRiderId || null,
        deliveryChargePkr: mode === "delivery" ? deliveryChargePkr : 0,
      });
    },
    onSuccess: () => {
      invalidateOrderFeeds();
      setPrintNotice({ message: "Held bill updated.", tone: "success" });
    },
    onError: (err: Error) => setPrintNotice({ message: err.message, tone: "error" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({
      intent,
      servicePct: checkoutServicePct,
      taxPct: checkoutTaxPct,
      payments,
      status,
      cashReceived,
    }: {
      intent: "pay" | "invoice" | "hold";
      servicePct: number;
      taxPct: number;
      payments: { method: "cash" | "card" | "wallet" | "bank"; amount: number }[];
      status: "completed" | "held";
      cashReceived?: number;
    }) => {
      const err = validateBillCheckout();
      if (err) throw new Error(err);

      const checkoutTotal = computeTicketTotals(
        subtotal,
        discount,
        checkoutServicePct,
        checkoutTaxPct,
        mode === "delivery" ? deliveryChargePkr : 0,
      ).total;
      const billNotesWithTender = packOrderNotesWithCashReceived(
        kitchenOrderNotes,
        cashReceived,
        checkoutTotal,
      );

      /**
       * Direct Pay / Invoice (no prior "Order"): create + print KOT first so kitchen
       * still gets the ticket. Leave it open (do not mark done) — kitchen needs it.
       * If cart already came from an open kitchen ticket, skip create (mark done after pay).
       */
      const needsKotOnPay =
        status === "completed" && editingOrder?.kind !== "ticket" && cart.length > 0;

      let sharedOrderRef: string | undefined =
        editingOrder?.kind === "ticket" || editingOrder?.kind === "held-bill"
          ? orderRef || undefined
          : undefined;
      const kotPrintErrors: string[] = [];
      let kotSent = false;

      if (needsKotOnPay) {
        sharedOrderRef = sharedOrderRef || nextOrderRef(branch!.code, mode);

        try {
          await createKitchenTicket({
            branchCode: branch!.code,
            orderRef: sharedOrderRef,
            stationLabel,
            lines: kitchenLines(),
            notes: kitchenOrderNotes,
            ...deliveryExtras(),
          });
          kotSent = true;
        } catch (kotErr) {
          const kotMsg = kotErr instanceof Error ? kotErr.message : String(kotErr);
          const bookedMatch = kotMsg.match(/booked by order\s+([A-Za-z0-9._-]+)/i);
          if (bookedMatch?.[1]) {
            // Table already has a kitchen ticket — settle that order instead of blocking Pay.
            sharedOrderRef = bookedMatch[1];
            kotSent = false;
          } else if (/is booked/i.test(kotMsg)) {
            // Booked without parsable ref — still allow bill close; kitchen KOT already exists.
            kotSent = false;
          } else {
            throw kotErr instanceof Error ? kotErr : new Error(kotMsg);
          }
        }

        if (kotSent) {
          const printed = await printKitchenKotsOnPay(sharedOrderRef);
          kotPrintErrors.push(...printed.errors);
        }
      }

      if (editingOrder?.kind === "held-bill") {
        const updated = await updateBill(editingOrder.billId, {
          tableLabel: billTableLabel,
          lines: cartToBillLines(effectiveCart),
          notes: billNotesWithTender ?? null,
          discountPkr: discount,
          servicePct: checkoutServicePct,
          taxPct: checkoutTaxPct,
          riderId: deliveryRiderId || null,
          deliveryChargePkr: mode === "delivery" ? deliveryChargePkr : 0,
        });
        if (status === "held") {
          return {
            bill: updated,
            intent,
            skipStaffFoodLog: true,
            kotSent,
            kotPrintErrors,
          };
        }
        const completed = await completeBill(editingOrder.billId, {
          payments,
          servicePct: checkoutServicePct,
          taxPct: checkoutTaxPct,
        });
        return {
          bill: completed,
          intent,
          skipStaffFoodLog: true,
          kotSent,
          kotPrintErrors,
        };
      }

      const bill = await createBill({
        branchCode: branch!.code,
        orderRef:
          sharedOrderRef ||
          (orderRef && orderRef.trim() ? orderRef.trim() : undefined) ||
          nextOrderRef(branch!.code, mode),
        tableLabel: billTableLabel,
        waiterId: shiftWaiterId || undefined,
        waiterName:
          mode === "staff-food" && staffFoodPersonName
            ? staffFoodPersonName
            : shiftWaiterName ||
              formatSessionPrintName(useSessionStore.getState().claims?.sub) ||
              sessionUserLabel ||
              "POS Counter",
        notes: billNotesWithTender,
        lines: cartToBillLines(effectiveCart),
        discountPct: discount > 0 ? discountPct : undefined,
        discountPkr: discount > 0 ? discount : undefined,
        servicePct: checkoutServicePct,
        taxPct: checkoutTaxPct,
        status,
        payments: status === "completed" ? payments : undefined,
        ...deliveryExtras(),
      });
      if (editingOrder?.kind === "ticket") {
        try {
          await updateKitchenTicket(editingOrder.ticketId, { status: "done" });
        } catch (doneErr) {
          if (!isKitchenTicketMissingError(doneErr)) throw doneErr;
        }
      }
      return {
        bill,
        intent,
        // Kitchen Order already logged HR; avoid a second record on Pay.
        skipStaffFoodLog: editingOrder?.kind === "ticket",
        kotSent,
        kotPrintErrors,
      };
    },
    onSuccess: async ({ bill, intent, skipStaffFoodLog, kotSent, kotPrintErrors }) => {
      setCheckoutModal(null);
      invalidateOrderFeeds();
      void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
      if (intent === "hold") {
        // Direct hold still records who took staff food.
        if (!skipStaffFoodLog) {
          await persistStaffFoodRecord();
        }
        resetAfterBill();
        setPrintNotice({ message: `Bill ${bill.billRef} held — complete payment from Orders.`, tone: "success" });
        return;
      }
      if (!skipStaffFoodLog) {
        await persistStaffFoodRecord();
      }
      const kotHint = kotSent
        ? kotPrintErrors.length > 0
          ? ` KOT saved but print failed (${kotPrintErrors.join("; ")}).`
          : " Kitchen ticket sent."
        : "";

      resetAfterBill();

      // Close → Pay: mark Closed + open that bill’s PRA invoice (Latest orders panel).
      if (intent === "pay" && pendingCloseAfterPayRef.current) {
        pendingCloseAfterPayRef.current = false;
        setCloseAfterPayBillId(bill.id);
        setPrintNotice({
          tone: "success",
          message: `${modeLabel} paid — ${bill.billRef}.${kotHint} Closing with PRA invoice…`,
        });
        const phone = phoneFromBillNotes(bill.notes);
        if (phone || mode === "delivery") {
          shareBillViaWhatsApp(bill, branch?.name ?? "POPS", phone);
        }
        return;
      }
      pendingCloseAfterPayRef.current = false;

      // Simple Card/Cash invoice = Latest-orders Print only (not auto on Pay/Invoice).
      setPrintNotice({
        tone: "success",
        message: `${modeLabel} ${intent === "invoice" ? "saved" : "paid"} — ${bill.billRef}.${kotHint} Simple invoice: Print button on the order.`,
      });
      const phone = phoneFromBillNotes(bill.notes);
      if (phone || mode === "delivery") {
        shareBillViaWhatsApp(bill, branch?.name ?? "POPS", phone);
      }
    },
    onError: (err: Error) => {
      pendingCloseAfterPayRef.current = false;
      setPrintNotice({ message: err.message, tone: "error" });
    },
  });

  const splitBillMutation = useMutation({
    mutationFn: async (splits: SplitBillPart[]) => {
      const err = validateBillCheckout();
      if (err) throw new Error(err);
      const groupRef = nextOrderRef(branch!.code, mode);

      // Same as direct Pay: kitchen must get a KOT even when splitting payment.
      if (editingOrder?.kind !== "ticket") {
        await createKitchenTicket({
          branchCode: branch!.code,
          orderRef: groupRef,
          stationLabel,
          lines: kitchenLines(),
          notes: kitchenOrderNotes,
          ...deliveryExtras(),
        });
        await printKitchenKotsOnPay(groupRef);
      }

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
          orderRef: groupRef,
          tableLabel: billTableLabel,
          waiterName:
            formatSessionPrintName(useSessionStore.getState().claims?.sub) ||
            sessionUserLabel ||
            "POS Counter",
          notes: notesWithKitchen ? `${notesWithKitchen} · ${split.label}` : split.label,
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
    onSuccess: async (bills) => {
      setSplitModalOpen(false);
      invalidateOrderFeeds();
      void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
      resetAfterBill();

      // Simple invoice = Latest-orders Print only (not auto on Split Pay).
      setPrintNotice({
        tone: "success",
        message: `${bills.length} split bills paid — ${bills.map((b) => b.billRef).join(", ")}. Simple invoice: Print button on the order.`,
      });
    },
    onError: (err: Error) => setPrintNotice({ message: err.message, tone: "error" }),
  });

  function buildKotPrintPayload(orderRefOverride?: string): Omit<PrintTicketInput, "kind"> {
    const payload = buildPrintPayload();
    const isUpdate = editingOrder?.kind === "ticket";
    let lines = payload.lines.map((line) => ({ ...line, unitPrice: 0 }));
    if (isUpdate && kotBaselineRef.current) {
      const deltas = diffKotLines(kotBaselineRef.current, printOrderedCart());
      lines = deltas.map((delta) => ({
        label: delta.printLabel,
        qty: delta.qty,
        unitPrice: 0,
      }));
    }
    return {
      ...payload,
      orderRef: orderRefOverride ?? payload.orderRef,
      lines,
      // Kitchen slip: free-text instruction (also saved on the ticket for Edit).
      notes: kitchenNote.trim()
        ? `Note: ${kitchenNote.trim()}`
        : notesWithKitchen,
      subtotal: 0,
      discount: 0,
      service: 0,
      tax: 0,
      total: 0,
      // Edited kitchen tickets print as UPDATE so kitchen can spot revisions.
      isOrderUpdate: isUpdate,
    };
  }

  /**
   * Kitchen KOT jobs for Order / Pay:
   * - Sections with a linked OS printer → silent Auto print (no dialog, never PDF)
   * - Sections without a linked OS printer → one Windows dialog for those lines only
   * - Never force the dialog when an assigned printer exists
   */
  async function printKitchenKotsOnPay(
    orderRefOverride?: string,
    _opts?: { forceDialog?: boolean },
  ): Promise<{ errors: string[]; skippedNoChanges?: boolean }> {
    const errors: string[] = [];
    const sessionUserId = useSessionStore.getState().claims?.sub;
    const routed = buildRoutedKotPrintPayloads(orderRefOverride);
    if (
      editingOrder?.kind === "ticket" &&
      kotBaselineRef.current &&
      routed.every((p) => p.lines.length === 0)
    ) {
      return { errors: [], skippedNoChanges: true };
    }

    const named = routed.filter((p) => Boolean(asPrinterName(p.systemPrinterName)));
    const unassigned = routed.filter((p) => !asPrinterName(p.systemPrinterName));

    for (const payload of named) {
      if (payload.lines.length === 0) continue;
      const result = await printKotDetailed({
        ...payload,
        copies: Math.max(1, payload.copies ?? 1),
      });
      const target = payload.systemPrinterName ?? payload.printerName ?? "Kitchen";
      if (!result.ok) {
        errors.push(`${target}: ${result.error ?? "print failed"}`);
      }
    }

    const unassignedLines = unassigned.flatMap((p) => p.lines);
    const namedHadLines = named.some((p) => p.lines.length > 0);
    // Dialog only when nothing is OS-linked, or leftover lines have no assignment.
    // Never open dialog after silent success just because a named job failed (that became PDF).
    if (!namedHadLines || unassignedLines.length > 0) {
      const profile = resolveKotPrinter(branch?.code, null, sessionUserId, "kitchen");
      const lines = !namedHadLines
        ? buildKotPrintPayload(orderRefOverride).lines
        : unassignedLines;
      if (lines.length === 0) {
        return { errors, skippedNoChanges: editingOrder?.kind === "ticket" };
      }
      const linkedName = asPrinterName(profile?.systemPrinterName);
      const dialogPayload = {
        ...withPrinterProfile(buildKotPrintPayload(orderRefOverride), profile),
        lines,
        copies: 1 as const,
        // Prefer linked OS name when profile has one; otherwise dialog (user picks).
        systemPrinterName: linkedName || undefined,
      };
      const result = await printKotDetailed(dialogPayload);
      const target = dialogPayload.systemPrinterName ?? dialogPayload.printerName ?? "Kitchen";
      if (!result.ok) {
        errors.push(`${target}: ${result.error ?? "print failed"}`);
      }
    }

    return { errors };
  }

  /**
   * Splits the KOT by printer section (Kitchen, Grill, Bar, ...) when categories/items
   * have a "Print to" assignment configured. Falls back to a single combined KOT — the
   * original behavior — when no routing is set up for anything in the cart.
   */
  function buildRoutedKotPrintPayloads(orderRefOverride?: string): Omit<PrintTicketInput, "kind">[] {
    const basePayload = buildKotPrintPayload(orderRefOverride);
    const sessionUserId = useSessionStore.getState().claims?.sub;
    const enabledSections = loadPrinterSections(branch?.code).filter((s) => s.enabled);

    const attachKotProfile = (
      payload: Omit<PrintTicketInput, "kind">,
      sectionId: string | null,
      preferredType: "kitchen" | "bar" = "kitchen",
    ): Omit<PrintTicketInput, "kind"> => {
      const profile = resolveKotPrinter(branch?.code, sectionId, sessionUserId, preferredType);
      return withPrinterProfile(payload, profile);
    };

    const updateCart =
      editingOrder?.kind === "ticket" && kotBaselineRef.current
        ? kotDeltasToCartLines(diffKotLines(kotBaselineRef.current, printOrderedCart()))
        : null;
    const cartForRouting = updateCart ?? printOrderedCart();

    if (enabledSections.length === 0) {
      return [attachKotProfile(basePayload, null, "kitchen")];
    }

    const enabledSectionIds = new Set(enabledSections.map((s) => s.id));
    const groups = groupCartLinesBySection(branch?.code, cartForRouting, enabledSectionIds);
    if (groups.length <= 1 && groups[0]?.sectionId == null) {
      return [attachKotProfile(basePayload, null, "kitchen")];
    }

    return groups.map(({ sectionId, lines }) => {
      const section = sectionId ? enabledSections.find((s) => s.id === sectionId) : null;
      const preferredType =
        section?.name.toLowerCase().includes("bar") || section?.id.includes("bar")
          ? ("bar" as const)
          : ("kitchen" as const);
      const label = section ? `${section.icon} ${section.name}` : "Kitchen";
      const orderedLines = sortCartLinesOldestFirst(lines);
      return attachKotProfile(
        {
          ...basePayload,
          lines: orderedLines.map((line) => ({
            // Update deltas already bake + ADD / ↑ EXTRA / etc into lineLabel.
            label:
              updateCart != null
                ? line.lineLabel
                : formatMenuItemPrintLabel({
                    name: line.item.name,
                    secondaryName: line.item.secondaryName,
                    portion: line.item.portion,
                    variantLabel: line.variant?.label ?? null,
                    simplePrice: line.item.simplePrice,
                  }),
            qty: line.qty,
            unitPrice: 0,
          })),
          printerName: label,
        },
        sectionId,
        preferredType,
      );
    });
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

  function openCustomerShortcut(): void {
    // Staff-food has no customer panel — switch to takeaway so details can be entered.
    if (!posModeShowsCustomerPanel(mode)) {
      switchMode("takeaway");
    }
    setDeliveryDetailsOpen(true);
    setDeliveryCustomerPickerOpen(true);
    setDeliveryCustomerSearch(deliveryCustomer.trim());
    window.setTimeout(() => {
      customerPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      deliveryCustomerInputRef.current?.focus();
      deliveryCustomerInputRef.current?.select();
    }, 50);
  }

  function applyCustomerDetails(): void {
    setDeliveryDetailsOpen(false);
    setDeliveryCustomerPickerOpen(false);

    // Persist customer details immediately when editing an existing order.
    if (editingOrder?.kind === "ticket" && branch?.code) {
      void updateKitchenTicket(editingOrder.ticketId, {
        notes: kitchenOrderNotes ?? null,
        ...deliveryExtras(),
      })
        .then(() => {
          invalidateOrderFeeds();
          setPrintNotice({
            tone: "success",
            message: "Customer details & discount saved.",
          });
        })
        .catch((err) => {
          setPrintNotice({
            tone: "error",
            message: err instanceof Error ? err.message : "Could not save customer details.",
          });
        });
      return;
    }
    if (editingOrder?.kind === "held-bill" && branch?.code) {
      void updateBill(editingOrder.billId, {
        notes: kitchenOrderNotes ?? null,
        discountPkr: discount > 0 ? discount : 0,
        discountPct: discount > 0 ? discountPct : undefined,
        ...deliveryExtras(),
      })
        .then(() => {
          invalidateOrderFeeds();
          setPrintNotice({
            tone: "success",
            message: "Customer details & discount saved.",
          });
        })
        .catch((err) => {
          setPrintNotice({
            tone: "error",
            message: err instanceof Error ? err.message : "Could not save customer details.",
          });
        });
      return;
    }

    // New ticket: remember last customer + discount for this branch so reopen / next edit restores.
    if (branch?.code) {
      savePosCustomerDiscountDraft(branch.code, {
        customer: deliveryCustomer,
        phone: deliveryPhone,
        address: deliveryAddress,
        discountEditedAs,
        discountPctInput,
        discountAmountInput,
        mode,
      });
    }

    if (posModeAutoPrintsOnCustomer(mode) && cart.length > 0 && !checkoutMutation.isPending) {
      runPrintInvoice();
    } else if (
      deliveryCustomer.trim() ||
      deliveryPhone.trim() ||
      deliveryAddress.trim() ||
      discountPctInput > 0 ||
      discountAmountInput > 0
    ) {
      setPrintNotice({
        tone: "success",
        message: "Customer details & discount applied — Order/Pay pe save ho jayega.",
      });
    }
  }

  function openHoldBill(): void {
    setCheckoutModal("hold");
  }

  function openSplitBill(): void {
    const err = validateBillCheckout();
    if (err) {
      setPrintNotice({ message: err, tone: "error" });
      return;
    }
    setSplitModalOpen(true);
  }

  const posShortcutBusy =
    Boolean(checkoutModal) ||
    Boolean(cashierModal) ||
    payOutModalOpen ||
    createAccountModalOpen ||
    teamChangeModalOpen ||
    myPrintersOpen ||
    splitModalOpen ||
    orderTypeModalOpen ||
    seatingModalOpen ||
    Boolean(variantPickerItem) ||
    Boolean(itemPrompt);

  const posShortcutActionsRef = useRef({
    search: () => {},
    qtyIncrease: () => {},
    orderType: () => {},
    quickOrder: () => {},
    pay: () => {},
    cashierIn: () => {},
    cashierOut: () => {},
    printBill: () => {},
    payOut: () => {},
    theme: () => {},
    customer: () => {},
    quickPrint: () => {},
  });

  posShortcutActionsRef.current = {
    search: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      setSearchDropdownOpen(true);
    },
    qtyIncrease: () => {
      const line =
        displayCart.find((l) => l.key === selectedCartKey) ?? displayCart[0] ?? null;
      if (!line) return;
      setSelectedCartKey(line.key);
      setQty(line.key, line.qty + 1);
    },
    orderType: () => {
      if (editingOrder) return;
      setOrderTypeModalOpen(true);
    },
    quickOrder: () => {
      if (cart.length === 0 || !branch?.code) return;
      if (editingOrder?.kind === "held-bill") {
        if (updateHeldBillMutation.isPending) return;
        updateHeldBillMutation.mutate();
        return;
      }
      if (createOrderMutation.isPending) return;
      createOrderMutation.mutate();
    },
    pay: () => {
      if (cart.length === 0 || checkoutMutation.isPending) return;
      onPay();
    },
    cashierIn: () => setCashierModal("in"),
    cashierOut: () => {
      if (!cashSessionQuery.data) return;
      setCashierModal("out");
    },
    printBill: () => {
      if (cart.length === 0 || checkoutMutation.isPending) return;
      runPrintInvoice();
    },
    payOut: () => setPayOutModalOpen(true),
    theme: () => useThemeStore.getState().toggle(),
    customer: () => openCustomerShortcut(),
    quickPrint: () => {
      const ok = latestOrdersQuickPrintRef.current?.();
      if (!ok) {
        setPrintNotice({
          message: "Latest orders se bill select karein, phir P dabayein (quick print).",
          tone: "error",
        });
      }
    },
  };

  useEffect(() => {
    function onGlobalKeyDown(e: KeyboardEvent): void {
      const id = matchPosShortcut(e);
      if (!id) return;
      // + / = only when not typing in an input
      if ((e.key === "+" || e.key === "=") && isTypingTarget(e.target)) return;
      // F-keys still work while typing (e.g. F9 search). Block action keys when a modal is open.
      if (posShortcutBusy && id !== "theme" && id !== "search") return;
      e.preventDefault();
      posShortcutActionsRef.current[id]();
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [posShortcutBusy]);

  const seatingLabel =
    mode === "dine-in" && selectedTable && selectedFloorSection
      ? `${selectedFloorSection.name} · Table ${selectedTable.tableNumber}`
      : mode === "dine-in"
        ? "Select table"
        : null;

  function toggleHeaderVisible(): void {
    const next = !headerVisible;
    setHeaderVisible(next);
    setPosHeaderVisible(next);
  }

  return (
    <div className="flex min-h-[calc(100vh-4.25rem)] flex-col gap-2">
      {terminalBlocked ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          This terminal is not authorized for POS access. Ask an admin to authorize it under Settings →
          Authorized terminals.
        </div>
      ) : null}
      {/* Compact toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 px-2.5 py-2">
        <button
          type="button"
          className={POS_HEADER_TOGGLE_BTN}
          aria-pressed={!headerVisible}
          aria-label={headerVisible ? "Hide top navigation bar" : "Show top navigation bar"}
          title={headerVisible ? "Hide top navigation" : "Show top navigation"}
          onClick={toggleHeaderVisible}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <div className="shrink-0 text-sm font-semibold text-white">POS</div>
        <div ref={searchContainerRef} className="relative min-w-0 flex-1 basis-[10rem] sm:max-w-md">
          <input
            ref={searchInputRef}
            placeholder="Search menu or scan SKU… (F9)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchDropdownOpen(true);
            }}
            onFocus={() => setSearchDropdownOpen(true)}
            onKeyDown={onSearchKeyDown}
            className="w-full rounded-md border border-slate-700/80 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/40"
          />
          {searchDropdownOpen && isSearching && searchDropdownItems.length > 0 ? (
            <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl">
              {searchDropdownItems.map((item, index) => {
                const price = menuItemDisplayPrice(item);
                const hasPicker = resolvePosSellableVariants(item).length > 1;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSearchHighlight(index)}
                    onClick={() => selectSearchDropdownItem(item)}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs transition ${
                      index === searchHighlight
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className={`shrink-0 font-semibold ${index === searchHighlight ? "" : "text-amber-300"}`}>
                      {hasPicker ? "From " : ""}
                      {price.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
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
            title={`${POS_SHORTCUTS.cashierIn.label} (${POS_SHORTCUTS.cashierIn.key})`}
            onClick={() => setCashierModal("in")}
          >
            Cashier in
          </button>
          <button
            type="button"
            className={POS_TOOLBAR_BTN}
            title={`${POS_SHORTCUTS.cashierOut.label} (${POS_SHORTCUTS.cashierOut.key})`}
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
          <button
            type="button"
            className={POS_TOOLBAR_BTN}
            title={`${POS_SHORTCUTS.payOut.label} (${POS_SHORTCUTS.payOut.key})`}
            onClick={() => setPayOutModalOpen(true)}
          >
            Paying out
          </button>
          <button
            type="button"
            className={POS_TOOLBAR_BTN}
            title="Create supplier or expense account"
            onClick={() => setCreateAccountModalOpen(true)}
          >
            New account
          </button>
          <button
            type="button"
            className={POS_TOOLBAR_BTN}
            title={
              shiftWaiterName || shiftTeam.riderName
                ? `Team: ${[shiftWaiterName, shiftTeam.riderName].filter(Boolean).join(" · ")}`
                : "Change waiter / rider team for this shift"
            }
            onClick={() => setTeamChangeModalOpen(true)}
          >
            Team
            {shiftWaiterName || shiftTeam.riderName ? (
              <span className="ml-1 max-w-[5.5rem] truncate text-[9px] opacity-80">
                {shiftWaiterName || shiftTeam.riderName}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`${POS_TOOLBAR_BTN}${
              deliveryDetailsOpen && posModeShowsCustomerPanel(mode)
                ? " bg-slate-800 text-white dark:bg-slate-800"
                : ""
            }`}
            title={`${POS_SHORTCUTS.customer.label} (${POS_SHORTCUTS.customer.key}) — open customer details`}
            onClick={() => openCustomerShortcut()}
          >
            Customer
          </button>
          <button
            type="button"
            className={POS_TOOLBAR_BTN}
            title="Assign your receipt / kitchen / bar printer"
            onClick={() => setMyPrintersOpen(true)}
          >
            My printers
          </button>
          <div className="ml-1 flex items-center gap-1.5 border-l border-slate-700/80 pl-2">
            <details className="relative">
              <summary
                className={`${POS_KEYS_BTN} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                title="Keyboard shortcuts"
              >
                Keys
              </summary>
              <div className="absolute right-0 z-40 mt-1 w-56 rounded-md border border-slate-700 bg-slate-950 p-2 text-[10px] text-slate-300 shadow-xl">
                {(Object.keys(POS_SHORTCUTS) as (keyof typeof POS_SHORTCUTS)[]).map((id) => (
                  <div key={id} className="flex justify-between gap-2 py-0.5">
                    <span>{POS_SHORTCUTS[id].label}</span>
                    <kbd className="rounded bg-slate-800 px-1 font-mono text-amber-300">
                      {POS_SHORTCUTS[id].key}
                    </kbd>
                  </div>
                ))}
                <div className="mt-1 border-t border-slate-800 pt-1 text-slate-500">
                  Qty + also works with <kbd className="font-mono text-amber-300/90">+</kbd>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      {menuQuery.isError ? (
        <p className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Could not load menu — {(menuQuery.error as Error).message}
        </p>
      ) : null}

      {orderTypeModalOpen && !editingOrder && !cashierModal ? (
        <PosOrderTypeModal
          selectedMode={mode}
          onSelect={confirmOrderType}
          onClose={dismissOrderTypeModal}
          modes={visiblePosOrderModes}
        />
      ) : null}

      {seatingModalOpen && mode === "dine-in" && modeConfirmed ? (
        <PosSeatingModal
          sections={floorSections}
          tables={floorTables}
          selectedSectionId={selectedFloorSectionId}
          selectedTableId={selectedTableId}
          isLoading={floorQuery.isLoading}
          occupiedTableNumbers={occupiedTableNumbers}
          onSelectSection={setSelectedFloorSectionId}
          onSelectTable={setSelectedTableId}
          onClose={() => {
            setSeatingModalOpen(false);
            markSeatingModalShown();
          }}
        />
      ) : null}

      {fullScreenMenuOpen ? (
        <PosFullScreenMenuOverlay
          categories={categories}
          items={menuItems}
          initialViewMode={posSettings.menuViewMode}
          priceLabel={(item) => {
            const original = menuItemDisplayPrice(item);
            if (happyHourActiveSlot?.percentOff) {
              return {
                display: applyHappyHourDiscountPrice(original, happyHourActiveSlot.percentOff),
                original,
              };
            }
            return { display: original };
          }}
          onPickItem={(item) => {
            onDishClick(item);
          }}
          onClose={() => setFullScreenMenuOpen(false)}
        />
      ) : null}

      {variantPickerItem ? (
        <PosDishVariantModal
          item={variantPickerItem}
          variants={resolvePosSellableVariants(variantPickerItem)}
          onSelect={(variant) => {
            beginAddToCart(variantPickerItem, variant);
            setVariantPickerItem(null);
          }}
          onClose={() => setVariantPickerItem(null)}
        />
      ) : null}

      {itemPrompt ? (
        <PosItemPromptModal
          item={itemPrompt.item}
          variant={itemPrompt.variant}
          defaultPrice={itemPrompt.variant?.price ?? itemPrompt.item.price}
          onConfirm={({ price, qty, lineNote }) => {
            addVariantToCart(itemPrompt.item, itemPrompt.variant, {
              qty,
              unitPrice: itemPrompt.item.askForPrice ? price : undefined,
              lineNote,
            });
            setItemPrompt(null);
          }}
          onClose={() => setItemPrompt(null)}
        />
      ) : null}

      {/* Main POS grid — UI zoom is applied globally from the top nav */}
      <div className="grid flex-1 grid-cols-12 gap-3 lg:items-start">
        {/* Menu column */}
        <div className="col-span-12 flex min-h-0 flex-col lg:col-span-4 lg:sticky lg:top-0 lg:h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-9rem)]">
          {/* Category pills — list or icon tiles */}
          {categories.length > 0 ? (
            <div className="mb-2.5 shrink-0 rounded-xl bg-amber-50 p-2 ring-1 ring-amber-200/80 dark:bg-slate-900/80 dark:ring-amber-500/20">
              <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/70 dark:text-amber-200/60">
                  Categories
                </span>
                <div className="flex items-center gap-1.5">
                  {posSettings.fullScreenMenuEnabled ? (
                    <button
                      type="button"
                      title="Full screen menu"
                      onClick={() => setFullScreenMenuOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-bold text-slate-950 shadow-sm shadow-amber-500/25 hover:bg-amber-400"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
                      </svg>
                      Full screen
                    </button>
                  ) : null}
                  <div
                    className="inline-flex rounded-md border border-amber-300/60 bg-white/80 p-0.5 dark:border-slate-700 dark:bg-slate-950/80"
                    role="group"
                    aria-label="Category layout"
                  >
                  <button
                    type="button"
                    title="List view"
                    aria-pressed={categoryLayout === "list"}
                    onClick={() => {
                      setCategoryLayout("list");
                      try {
                        localStorage.setItem("pops-pos-category-layout", "list");
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`rounded px-1.5 py-1 transition ${
                      categoryLayout === "list"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    title="Icon view"
                    aria-pressed={categoryLayout === "icon"}
                    onClick={() => {
                      setCategoryLayout("icon");
                      try {
                        localStorage.setItem("pops-pos-category-layout", "icon");
                      } catch {
                        /* ignore */
                      }
                    }}
                    className={`rounded px-1.5 py-1 transition ${
                      categoryLayout === "icon"
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  </button>
                </div>
                </div>
              </div>

              {categoryLayout === "list" ? (
                <div className="flex max-h-36 flex-col gap-1 overflow-y-auto pr-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuView("all");
                      setCategoryId(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                      showAllItems
                        ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                    }`}
                  >
                    <span>All</span>
                    <span className="tabular-nums opacity-70">{menuItems.filter((m) => m.isActive).length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuView("featured")}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                      showFeaturedOnly
                        ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className={showFeaturedOnly ? "text-slate-950" : "text-amber-500"} aria-hidden>
                        ★
                      </span>
                      Featured
                    </span>
                    {featuredCount > 0 ? (
                      <span className="tabular-nums opacity-70">{featuredCount}</span>
                    ) : null}
                  </button>
                  {categories.map((c) => {
                    const count = menuItems.filter((m) => m.isActive && m.categoryId === c.id).length;
                    const active = menuView === "category" && activeCategoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        title={c.name}
                        onClick={() => {
                          setMenuView("category");
                          setCategoryId(c.id);
                        }}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold transition ${
                          active
                            ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="ml-2 shrink-0 tabular-nums opacity-70">{count}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuView("all");
                      setCategoryId(null);
                    }}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-center transition ${
                      showAllItems
                        ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold ${
                        showAllItems ? "bg-slate-950/15" : "bg-amber-100 text-amber-800 dark:bg-slate-950/60 dark:text-amber-300"
                      }`}
                    >
                      All
                    </span>
                    <span className="line-clamp-2 w-full text-[10px] font-semibold leading-tight">All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuView("featured")}
                    className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-center transition ${
                      showFeaturedOnly
                        ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-md text-base ${
                        showFeaturedOnly ? "bg-slate-950/15" : "bg-amber-100 text-amber-600 dark:bg-slate-950/60 dark:text-amber-300"
                      }`}
                      aria-hidden
                    >
                      ★
                    </span>
                    <span className="line-clamp-2 w-full text-[10px] font-semibold leading-tight">
                      Featured{featuredCount > 0 ? ` (${featuredCount})` : ""}
                    </span>
                  </button>
                  {categories.map((c) => {
                    const active = menuView === "category" && activeCategoryId === c.id;
                    const img = resolveMenuImageUrl(c.imageUrl);
                    const initial = (c.name.trim().charAt(0) || "?").toUpperCase();
                    return (
                      <button
                        key={c.id}
                        type="button"
                        title={c.name}
                        onClick={() => {
                          setMenuView("category");
                          setCategoryId(c.id);
                        }}
                        className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1.5 py-2 text-center transition ${
                          active
                            ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-100/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                        }`}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="h-9 w-9 rounded-md object-cover ring-1 ring-black/5"
                          />
                        ) : (
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold ${
                              active
                                ? "bg-slate-950/15"
                                : "bg-amber-100 text-amber-800 dark:bg-slate-950/60 dark:text-amber-300"
                            }`}
                          >
                            {initial}
                          </span>
                        )}
                        <span className="line-clamp-2 w-full text-[10px] font-semibold leading-tight">
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {showAllItems && !isSearching ? (
            <p className="mb-1 shrink-0 text-[10px] text-slate-500">
              {filteredMenu.length === 0
                ? "No menu items yet."
                : `${filteredMenu.length} item${filteredMenu.length === 1 ? "" : "s"} · A–Z`}
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
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-6">
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
                      className="flex flex-col rounded-md border border-slate-800/80 bg-slate-900/40 p-1.5 text-left transition hover:border-amber-500/30 hover:bg-slate-900"
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

        {/* Current ticket — cart shows 6 items (3×2); scroll for the rest */}
        <div className="col-span-12 flex min-h-[36rem] flex-col rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 lg:col-span-4 lg:sticky lg:top-0 lg:h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-9rem)] lg:min-h-0 dark:border-slate-700/50 dark:bg-gradient-to-b dark:from-slate-900/95 dark:to-slate-950 dark:shadow-xl dark:shadow-black/25 dark:ring-1 dark:ring-white/5">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/40 dark:backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    {editingOrder ? "Editing" : "Current ticket"}
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-400">
                    {posOrderModeLabel(mode)}
                  </span>
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                  {editingOrder ? "Modify order" : mode === "staff-food" ? "Staff food" : "New order"}
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
            <div className={POS_MODE_BAR} title={`Order type (${POS_SHORTCUTS.orderType.key})`}>
              {visiblePosOrderModes.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => {
                    switchMode(id);
                    e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                  }}
                  className={POS_MODE_BTN(mode === id)}
                >
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

            {mode === "staff-food" ? (
              <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700/60 dark:bg-slate-950/40">
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={staffFoodConsumerType}
                    onChange={(e) => {
                      const next = e.target.value as StaffFoodConsumerType;
                      setStaffFoodConsumerType(next);
                      setStaffFoodEmployeeId("");
                      setStaffFoodGuestName("");
                      setStaffFoodPendingName("");
                    }}
                    className={`${TICKET_INPUT_CLASS} py-1.5`}
                  >
                    <option value="staff">Staff</option>
                    <option value="guest">Guest</option>
                  </select>
                  {staffFoodConsumerType === "staff" ? (
                    <SearchableSelect
                      value={staffFoodEmployeeId}
                      onChange={(next) => {
                        setStaffFoodEmployeeId(next);
                        setStaffFoodPendingName("");
                      }}
                      options={activeStaffEmployees.map((employee) => ({
                        value: employee.id,
                        label: employee.jobTitle
                          ? `${employee.displayName} · ${employee.jobTitle}`
                          : employee.displayName,
                        searchText: `${employee.displayName} ${employee.jobTitle ?? ""}`,
                        meta: formatSelectBalance(staffOpenAdvanceById.get(employee.id) ?? 0),
                      }))}
                      placeholder={
                        staffEmployeesQuery.isLoading ? "Loading staff…" : "Select staff *"
                      }
                      searchPlaceholder="Search staff…"
                      allowEmpty
                      className={!staffFoodEmployeeId ? "[&_button]:border-amber-400 dark:[&_button]:border-amber-500/40" : ""}
                      aria-label="Select staff"
                      required
                    />
                  ) : (
                    <input
                      placeholder="Guest name *"
                      value={staffFoodGuestName}
                      onChange={(e) => setStaffFoodGuestName(e.target.value)}
                      className={`${TICKET_INPUT_CLASS} py-1.5 ${
                        !staffFoodGuestName.trim() ? "border-amber-400 dark:border-amber-500/40" : ""
                      }`}
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={staffFoodExpenseCategory}
                    onChange={(e) =>
                      setStaffFoodExpenseCategory(e.target.value as ExpenseCategory)
                    }
                    className={`${TICKET_INPUT_CLASS} py-1.5`}
                    aria-label="Expense account"
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <SearchableSelect
                    value={staffFoodSupplierId}
                    onChange={setStaffFoodSupplierId}
                    options={activeStaffFoodSuppliers.map((supplier) => ({
                      value: supplier.id,
                      label: supplier.name,
                      searchText: `${supplier.name} ${supplier.phone ?? ""}`,
                      meta: supplier.phone ?? undefined,
                    }))}
                    placeholder={
                      staffFoodSuppliersQuery.isLoading ? "Loading…" : "Supplier (optional)"
                    }
                    searchPlaceholder="Search supplier…"
                    allowEmpty
                    aria-label="Supplier"
                  />
                </div>
                <input
                  placeholder="Notes (optional)"
                  value={staffFoodExtraNotes}
                  onChange={(e) => setStaffFoodExtraNotes(e.target.value)}
                  className={`${TICKET_INPUT_CLASS} py-1.5`}
                />
                {staffFoodPersonName ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Ticket will show Staff Food · {staffFoodPersonName}
                    {" · "}
                    Expense: {staffFoodExpenseCategory}
                  </p>
                ) : (
                  <p className="text-[10px] text-amber-700 dark:text-amber-300">
                    Select who took the food, then add menu items and Order / Pay as usual.
                  </p>
                )}
              </div>
            ) : null}

            {posModeShowsCustomerPanel(mode) ? (
              <div className="mt-2" ref={customerPanelRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryDetailsOpen((open) => {
                      const next = !open;
                      if (next) {
                        setDeliveryCustomerPickerOpen(true);
                        setDeliveryCustomerSearch(deliveryCustomer.trim());
                        window.setTimeout(() => {
                          deliveryCustomerInputRef.current?.focus();
                        }, 0);
                      } else {
                        setDeliveryCustomerPickerOpen(false);
                      }
                      return next;
                    });
                  }}
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
                    <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-1.5">
                      <div className="relative min-w-0" ref={deliveryCustomerFieldRef}>
                        <input
                          ref={deliveryCustomerInputRef}
                          placeholder="Customer — type to search"
                          value={deliveryCustomer}
                          onChange={(e) => handleDeliveryCustomerChange(e.target.value)}
                          onFocus={() => {
                            setDeliveryCustomerPickerOpen(true);
                            setDeliveryCustomerSearch(deliveryCustomer.trim());
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              deliveryPhoneInputRef.current?.focus();
                            }
                            if (e.key === "Escape") {
                              setDeliveryCustomerPickerOpen(false);
                            }
                          }}
                          className={`${TICKET_INPUT_CLASS} py-1.5`}
                        />
                        {deliveryCustomerPickerOpen ? (
                          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            {customerInvoicesQuery.isLoading ? (
                              <p className="px-2.5 py-2 text-xs text-slate-500">Loading customers…</p>
                            ) : customerInvoicesQuery.isError ? (
                              <p className="px-2.5 py-2 text-xs text-red-600 dark:text-red-400">
                                Could not load accounts: {(customerInvoicesQuery.error as Error).message}
                              </p>
                            ) : filteredDeliveryCustomers.length === 0 ? (
                              <p className="px-2.5 py-2 text-xs text-slate-500">
                                No saved customers yet — type a name/phone, or add from Accounts.
                              </p>
                            ) : (
                              filteredDeliveryCustomers.map((customer) => (
                                <button
                                  key={`${customer.name}-${customer.phone}`}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectKnownDeliveryCustomer(customer)}
                                  className="flex w-full flex-col items-start gap-0 px-2.5 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <span className="font-medium">{customer.name}</span>
                                  {customer.phone ? (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {customer.phone}
                                    </span>
                                  ) : null}
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                      <input
                        ref={deliveryPhoneInputRef}
                        placeholder="Phone"
                        type="tel"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyCustomerDetails();
                          }
                        }}
                        className={`${TICKET_INPUT_CLASS} py-1.5`}
                        title="Customer phone"
                      />
                    </div>
                    {mode === "delivery" ? (
                      <>
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
                            <option value="">
                              {ridersQuery.isLoading
                                ? "Loading riders…"
                                : ridersQuery.isError
                                  ? "Could not load riders"
                                  : activeRiders.length === 0
                                    ? "No riders for this branch"
                                    : "Rider *"}
                            </option>
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
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => applyCustomerDetails()}
                      className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-500/25 dark:text-amber-100"
                    >
                      {mode === "takeaway"
                        ? "Apply"
                        : posModeAutoPrintsOnCustomer(mode) && cart.length > 0
                          ? "Apply & print receipt"
                          : "Apply customer"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-2 flex items-center justify-end gap-2">
              <div
                className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950"
                role="group"
                aria-label="Cart layout"
              >
                <button
                  type="button"
                  title="List view"
                  aria-pressed={cartLayout === "list"}
                  onClick={() => {
                    setCartLayout("list");
                    try {
                      localStorage.setItem("pops-pos-cart-layout", "list");
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`rounded px-1.5 py-1 transition ${
                    cartLayout === "list"
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Grid view"
                  aria-pressed={cartLayout === "grid"}
                  onClick={() => {
                    setCartLayout("grid");
                    try {
                      localStorage.setItem("pops-pos-cart-layout", "grid");
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`rounded px-1.5 py-1 transition ${
                    cartLayout === "grid"
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
              </div>
            </div>

            {posSettings.showBillNotes ? (
              <>
                <input
                  type="text"
                  value={kitchenNote}
                  onChange={(e) => setKitchenNote(e.target.value.slice(0, 200))}
                  placeholder="Bill note (optional) — whole order, e.g. birthday table"
                  maxLength={200}
                  className={`mt-1.5 ${TICKET_INPUT_CLASS} py-1.5`}
                  title="General note for this bill / kitchen"
                />

                {selectedCartLine && !selectedCartLine.isComplimentary ? (
                  <input
                    type="text"
                    value={selectedCartLine.lineNote ?? ""}
                    onChange={(e) => {
                      const note = e.target.value.slice(0, 80);
                      setCart((prev) =>
                        prev.map((l) => {
                          if (l.key !== selectedCartLine.key) return l;
                          const nextNote = note.trim() || undefined;
                          const baseKey = `${l.item.id}${l.variant?.id ? `:${l.variant.id}` : ""}`;
                          const nextKey = nextNote ? `${baseKey}::note:${nextNote}` : baseKey;
                          return { ...l, lineNote: nextNote, key: nextKey };
                        }),
                      );
                      const baseKey = `${selectedCartLine.item.id}${
                        selectedCartLine.variant?.id ? `:${selectedCartLine.variant.id}` : ""
                      }`;
                      const nextKey = note.trim() ? `${baseKey}::note:${note.trim()}` : baseKey;
                      setSelectedCartKey(nextKey);
                    }}
                    placeholder={`Item note — e.g. بدون مرچ (${selectedCartLine.lineLabel})`}
                    maxLength={80}
                    className={`mt-1.5 ${TICKET_INPUT_CLASS} py-1.5`}
                    title="Note for selected item only (KOT + bill)"
                  />
                ) : (
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    Select an item below to add an item note.
                  </p>
                )}
              </>
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
            <p
              className={`shrink-0 border-b px-3 py-2 text-[11px] font-medium ${
                printNotice.tone === "error"
                  ? "border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
              }`}
            >
              {printNotice.message}
            </p>
          ) : null}

          <div className="shrink-0 p-3">
            {displayCart.length === 0 ? (
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
              <div
                ref={cartListRef}
                className={
                  displayCart.length >
                  (cartLayout === "list" ? POS_CART_LIST_VISIBLE_COUNT : POS_CART_VISIBLE_COUNT)
                    ? "overflow-y-auto overscroll-contain pr-1"
                    : "overflow-hidden"
                }
                style={{
                  height: `${posCartListHeightPx(displayCart.length, cartLayout)}px`,
                  maxHeight: `${
                    cartLayout === "list"
                      ? POS_CART_LIST_ROW_PX * POS_CART_LIST_VISIBLE_COUNT +
                        POS_CART_GRID_GAP_PX * (POS_CART_LIST_VISIBLE_COUNT - 1)
                      : POS_CART_LIST_MAX_PX
                  }px`,
                }}
              >
              <ul
                className={
                  cartLayout === "list"
                    ? "flex flex-col gap-1.5"
                    : "grid grid-cols-3 gap-2"
                }
                style={
                  cartLayout === "grid"
                    ? { gridAutoRows: `${POS_CART_CARD_ROW_PX}px` }
                    : undefined
                }
              >
                {displayCart.map((line) => {
                  const isSelected = selectedCartLine?.key === line.key;
                  if (cartLayout === "list") {
                    return (
                      <li
                        key={line.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedCartKey(line.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedCartKey(line.key);
                          }
                        }}
                        className={`flex min-h-[48px] cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                          line.isComplimentary
                            ? "border-amber-400/40 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5"
                            : isSelected
                              ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400/50 dark:border-amber-500/50 dark:bg-amber-500/10 dark:ring-amber-500/30"
                              : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/50 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-medium text-slate-900 dark:text-slate-100">
                            {cartLinePrintLabel(line)}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] tabular-nums text-slate-500">
                            {line.isComplimentary ? (
                              <span className="font-medium text-amber-700 dark:text-amber-400">Free</span>
                            ) : (
                              <span>Rs {line.unitPrice.toLocaleString()}</span>
                            )}
                            {line.lineNote?.trim() ? (
                              <span className="truncate text-amber-700 dark:text-amber-300">
                                · {line.lineNote.trim()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {line.isComplimentary ? (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                            FREE
                          </span>
                        ) : (
                          <div
                            className="flex shrink-0 items-center gap-0.5 rounded-md bg-slate-100 p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="flex h-6 w-6 items-center justify-center rounded text-sm text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                              onClick={() => {
                                setSelectedCartKey(line.key);
                                setQty(line.key, line.qty - 1);
                              }}
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="min-w-[1.1rem] text-center text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              className="flex h-6 w-6 items-center justify-center rounded text-sm text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                              onClick={() => {
                                setSelectedCartKey(line.key);
                                setQty(line.key, line.qty + 1);
                              }}
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  }
                  return (
                  <li
                    key={line.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCartKey(line.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCartKey(line.key);
                      }
                    }}
                    className={`flex min-h-0 min-w-0 cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border px-2 py-2 transition ${
                      line.isComplimentary
                        ? "border-amber-400/40 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5"
                        : isSelected
                          ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400/50 dark:border-amber-500/50 dark:bg-amber-500/10 dark:ring-amber-500/30"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/50 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="min-h-0 min-w-0 flex-1 overflow-hidden leading-snug">
                      <div className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-900 dark:text-slate-100">
                        {cartLinePrintLabel(line)}
                      </div>
                      {line.lineNote?.trim() ? (
                        <div className="mt-0.5 line-clamp-1 text-[9px] text-amber-700 dark:text-amber-300">
                          Note: {line.lineNote.trim()}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[10px] tabular-nums text-slate-500">
                        {line.isComplimentary ? (
                          <span className="font-medium text-amber-700 dark:text-amber-400">Free</span>
                        ) : (
                          <>
                            Rs {line.unitPrice.toLocaleString()} each
                            {cartLineManualDiscountPkr(line) > 0 ? (
                              <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                                · net Rs {cartLineNet(line).toLocaleString()}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                      {!line.isComplimentary && !isMenuItemDiscountable(line.item) ? (
                        <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-rose-600 dark:text-rose-400">
                          Non-discountable
                        </div>
                      ) : null}
                      {!line.isComplimentary && line.item.nonTaxable ? (
                        <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-sky-600 dark:text-sky-400">
                          Non-taxable
                        </div>
                      ) : null}
                    </div>
                    {line.isComplimentary ? (
                      <span className="self-start rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                        FREE
                      </span>
                    ) : (
                      <>
                      <div
                        className="flex w-full items-center justify-center gap-1 rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-sm leading-none text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          onClick={() => {
                            setSelectedCartKey(line.key);
                            setQty(line.key, line.qty - 1);
                          }}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="min-w-[1rem] text-center text-[11px] font-semibold tabular-nums text-slate-900 dark:text-white">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-sm leading-none text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                          title={`Qty + (${POS_SHORTCUTS.qtyIncrease.key} or +)`}
                          onClick={() => {
                            setSelectedCartKey(line.key);
                            setQty(line.key, line.qty + 1);
                          }}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      {canEditLineDiscount(line) ? (
                        <div
                          className="grid grid-cols-2 gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="text-[9px] uppercase tracking-wide text-slate-500">
                            Disc %
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              value={
                                line.lineDiscountMode === "percent" ? (line.lineDiscountValue ?? 0) : ""
                              }
                              placeholder="0"
                              onChange={(e) =>
                                setLineDiscount(line.key, "percent", Number(e.target.value) || 0)
                              }
                            />
                          </label>
                          <label className="text-[9px] uppercase tracking-wide text-slate-500">
                            Disc Rs
                            <input
                              type="number"
                              min={0}
                              className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              value={
                                line.lineDiscountMode === "amount" ? (line.lineDiscountValue ?? 0) : ""
                              }
                              placeholder="0"
                              onChange={(e) =>
                                setLineDiscount(line.key, "amount", Number(e.target.value) || 0)
                              }
                            />
                          </label>
                        </div>
                      ) : null}
                      </>
                    )}
                  </li>
                  );
                })}
              </ul>
              </div>
            )}
          </div>

          <div className="mt-auto shrink-0 border-t border-slate-200 bg-slate-50 p-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)] dark:border-slate-800/80 dark:bg-slate-950/95 dark:shadow-[0_-4px_12px_rgba(0,0,0,0.35)]">
            <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800/80">
              {autoDiscountEnabled && autoDiscountAmount > 0 ? (
                <div className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Auto discount {autoDiscountPct}%
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                      − {autoDiscountAmount.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-emerald-800/80 dark:text-emerald-200/70">
                    Applied automatically on every sale. Item prices stay at original; discount is
                    shown in the total below.
                  </p>
                </div>
              ) : showTicketDiscount ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Discount
                    </span>
                    <div className="flex gap-1">
                      {[5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-amber-100 hover:text-amber-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-amber-500/20 dark:hover:text-amber-200"
                          onClick={() => onDiscountPctChange(pct)}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
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
                </>
              ) : selectedCartLine && lineBlocksBillDiscount(selectedCartLine) ? (
                <p className="mb-2 text-[10px] text-rose-600 dark:text-rose-400">
                  {selectedCartLine.item.nonTaxable ? "Non-taxable" : "Non-discountable"} item
                  selected — Disc % / Disc Rs hidden. Tap a normal item to show discount.
                </p>
              ) : null}
              <div
                className={`${autoDiscountEnabled || showTicketDiscount ? "mt-3" : ""} space-y-1.5 text-xs`}
              >
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal (original)</span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-300">
                    {subtotal.toLocaleString()}
                  </span>
                </div>
                {discount > 0 ? (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400/90">
                    <span>
                      {autoDiscountEnabled ? `Discount ${autoDiscountPct}%` : "Discount"}
                    </span>
                    <span className="tabular-nums">− {discount.toLocaleString()}</span>
                  </div>
                ) : null}
                {discount > 0 ? (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>After discount</span>
                    <span className="tabular-nums text-slate-900 dark:text-slate-300">
                      {(subtotal - discount).toLocaleString()}
                    </span>
                  </div>
                ) : null}
                {ticketServicePct > 0 && service > 0 ? (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Service {ticketServicePct}%</span>
                    <span className="tabular-nums text-slate-900 dark:text-slate-300">
                      {service.toLocaleString()}
                    </span>
                  </div>
                ) : null}
                {showTaxRow ? (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Tax {taxPct}%</span>
                    <span className="tabular-nums text-slate-900 dark:text-slate-300">
                      {tax.toLocaleString()}
                    </span>
                  </div>
                ) : null}
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
                  title={`${POS_SHORTCUTS.quickOrder.label} (${POS_SHORTCUTS.quickOrder.key})`}
                  disabled={cart.length === 0 || updateHeldBillMutation.isPending || !branch?.code}
                  onClick={() => updateHeldBillMutation.mutate()}
                >
                  {updateHeldBillMutation.isPending ? "…" : "Update hold"}
                </button>
              ) : (
                <button
                  type="button"
                  className={POS_PRIMARY_ORDER_BTN}
                  title={`${POS_SHORTCUTS.quickOrder.label} (${POS_SHORTCUTS.quickOrder.key})`}
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
                title={`${POS_SHORTCUTS.pay.label} (${POS_SHORTCUTS.pay.key})`}
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
                title="Print kitchen order ticket — order stays editable"
              >
                {createOrderMutation.isPending ? "…" : "Print order"}
              </button>
              <button
                type="button"
                className={POS_SECONDARY_BTN}
                title={`${POS_SHORTCUTS.printBill.label} (${POS_SHORTCUTS.printBill.key}) — final bill`}
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
            closeAfterPayBillId={closeAfterPayBillId}
            onCloseAfterPayHandled={() => setCloseAfterPayBillId(null)}
            onNotice={(message, tone = "success") => setPrintNotice({ message, tone })}
            quickPrintRef={latestOrdersQuickPrintRef}
          />
        </div>
      </div>

      {checkoutModal ? (
        <PosCheckoutModal
          mode={checkoutModal}
          orderMode={mode}
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
          onClose={() => {
            pendingCloseAfterPayRef.current = false;
            setCheckoutModal(null);
          }}
          onValidationError={(message) => setPrintNotice({ message, tone: "error" })}
          onConfirm={({
            servicePct: checkoutServicePct,
            taxPct: checkoutTaxPct,
            payments,
            status,
            cashReceived,
          }) =>
            checkoutMutation.mutate({
              intent: checkoutModal,
              servicePct: checkoutServicePct,
              taxPct: checkoutTaxPct,
              payments,
              status,
              cashReceived,
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
          onSuccess={(message, updated) => {
            setPrintNotice({ message, tone: "success" });
            if (updated) {
              applyTableFromStation(updated.stationLabel);
              if (
                editingOrder?.kind === "ticket" &&
                editingOrder.ticketId === updated.id
              ) {
                applyTicketToPos(updated);
              }
            }
          }}
        />
      ) : null}

      {payOutModalOpen ? (
        <PosPayOutModal
          onClose={() => setPayOutModalOpen(false)}
          onSuccess={(message) => setPrintNotice({ message, tone: "success" })}
        />
      ) : null}

      {createAccountModalOpen ? (
        <PosCreateAccountModal
          onClose={() => setCreateAccountModalOpen(false)}
          onSuccess={(message) => setPrintNotice({ message, tone: "success" })}
        />
      ) : null}

      {teamChangeModalOpen ? (
        <PosTeamChangeModal
          onClose={() => setTeamChangeModalOpen(false)}
          onSuccess={(message) => {
            setShiftTeam(loadPosShiftTeam(branch?.code));
            setPrintNotice({ message, tone: "success" });
            if (mode === "delivery") {
              const team = loadPosShiftTeam(branch?.code);
              if (team.riderId && !deliveryRiderId) setDeliveryRiderId(team.riderId);
            }
          }}
        />
      ) : null}

      {myPrintersOpen && branch?.code ? (
        <PosMyPrintersModal
          branchCode={branch.code}
          userId={sessionUserId}
          userLabel={sessionUserLabel}
          onClose={() => setMyPrintersOpen(false)}
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
            setPrintNotice({ message, tone: "success" });
          }}
        />
      ) : null}

      <PraModeConfirmDialog
        open={praModePromptOpen}
        busy={praModeBusy}
        onFake={() => {
          const pending = pendingPraPayRef.current;
          if (!pending) {
            setPraModePromptOpen(false);
            return;
          }
          setPraModeBusy(true);
          void pending
            .run("fake")
            .catch((err: Error) => setPrintNotice({ message: err.message, tone: "error" }))
            .finally(() => {
              setPraModeBusy(false);
              setPraModePromptOpen(false);
              pendingPraPayRef.current = null;
            });
        }}
        onReal={() => {
          const pending = pendingPraPayRef.current;
          if (!pending) {
            setPraModePromptOpen(false);
            return;
          }
          setPraModeBusy(true);
          void pending
            .run("real")
            .catch((err: Error) => setPrintNotice({ message: err.message, tone: "error" }))
            .finally(() => {
              setPraModeBusy(false);
              setPraModePromptOpen(false);
              pendingPraPayRef.current = null;
            });
        }}
        onCancel={() => {
          const pending = pendingPraPayRef.current;
          setPraModeBusy(true);
          void (pending?.skipPra() ?? Promise.resolve())
            .catch((err: Error) => setPrintNotice({ message: err.message, tone: "error" }))
            .finally(() => {
              setPraModeBusy(false);
              setPraModePromptOpen(false);
              pendingPraPayRef.current = null;
            });
        }}
      />

      <PraFiscalInvoiceModal
        fiscal={praFiscal}
        open={praModalOpen}
        printing={praPrinting}
        branchName={branch?.name}
        branchCode={branch?.code}
        onClose={() => {
          setPraModalOpen(false);
          setPraFiscal(null);
        }}
        onPrint={() => {
          if (!praFiscal) return;
          setPraPrinting(true);
          const printUserId = resolvePrintUserId(sessionUserId, null);
          const profile = resolveReceiptPrinter(branch?.code, printUserId);
          void printIssuedPraSlip(praFiscal, {
            branchName: branch?.name,
            branchCode: branch?.code,
            systemPrinterName: profile?.systemPrinterName ?? null,
          })
            .then((res) => {
              if (!res.ok) {
                setPrintNotice({
                  message: res.error ?? "Invoice print failed.",
                  tone: "error",
                });
              }
            })
            .finally(() => setPraPrinting(false));
        }}
      />
    </div>
  );
}
