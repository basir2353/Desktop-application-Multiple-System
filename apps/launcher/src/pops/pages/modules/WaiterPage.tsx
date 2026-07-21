import { Button } from "@platform/ui";
import { formatMenuItemLabel, type MenuItem as ApiMenuItem } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import { createBill, createWaiter, fetchWaiters, updateWaiter } from "../../api/billing";
import { fetchKitchenTickets, createKitchenTicket } from "../../api/kitchen";
import { fetchBranchMenu } from "../../api/menu";
import { fetchBranchFloor } from "../../api/tables";
import {
  printReceiptAsync,
  printKotDetailed,
  billToPrintInput,
  withPrinterProfile,
  type PrintTicketInput,
} from "../../lib/printTicket";
import {
  getPrintersForUser,
  groupCartLinesBySection,
  listPrintersByType,
  PRINTER_ROUTING_CHANGED_EVENT,
  resolveKotPrinter,
  resolveReceiptPrinter,
  setUserPrinterForType,
} from "../../lib/printerRouting";
import { loadPrinterSections } from "../../lib/printerSections";
import type { PosCartLine } from "../../lib/posCart";
import {
  getWaiterPrinter,
  setWaiterPrinter,
  WAITER_PRINTER_SETTINGS_CHANGED_EVENT,
} from "../../lib/waiterPrinterSettings";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import {
  amberPillActiveClass,
  cardClass,
  countBadgeClass,
  fieldInputClass,
  fieldSelectClass,
  mutedClass,
  noticeSuccessClass,
  panelClass,
  panelTitleClass,
  pillInactiveClass,
  subtleClass,
} from "../../lib/themeClasses";

type CartLine = { item: ApiMenuItem; qty: number; sortOrder: number };

function sortWaiterCart(cart: CartLine[]): CartLine[] {
  return [...cart].sort((a, b) => b.sortOrder - a.sortOrder);
}

function nextWaiterCartSortOrder(cart: CartLine[]): number {
  return cart.reduce((max, line) => Math.max(max, line.sortOrder), 0) + 1;
}

type TableDraft = {
  cart: CartLine[];
  notes: string;
  orderRef: string;
  waiterId: string | null;
};

type StoredLastOrder = {
  cart: CartLine[];
  notes: string;
};

const SERVICE_PCT = 10;

function storageKey(branchCode: string): string {
  return `pops-waiter-drafts-v1-${branchCode}`;
}

function lastOrderKey(branchCode: string, tableId: string): string {
  return `pops-waiter-last-v1-${branchCode}-${tableId}`;
}

function loadDrafts(branchCode: string): Record<string, TableDraft> {
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, TableDraft>;
  } catch {
    return {};
  }
}

function saveDrafts(branchCode: string, drafts: Record<string, TableDraft>): void {
  localStorage.setItem(storageKey(branchCode), JSON.stringify(drafts));
}

function loadLastOrder(branchCode: string, tableId: string): StoredLastOrder | null {
  try {
    const raw = localStorage.getItem(lastOrderKey(branchCode, tableId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredLastOrder;
  } catch {
    return null;
  }
}

function saveLastOrder(branchCode: string, tableId: string, order: StoredLastOrder): void {
  localStorage.setItem(lastOrderKey(branchCode, tableId), JSON.stringify(order));
}

function matchesTable(stationLabel: string, tableNumber: string): boolean {
  const label = stationLabel.trim().toLowerCase();
  const t = tableNumber.toLowerCase();
  return label === t || label === `table ${t}` || label.endsWith(` ${t}`);
}

function tableStatusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "free") return "success";
  if (status === "booked") return "warning";
  return "info";
}

function newWaiterOrderRef(): string {
  return `ORD-${Date.now().toString().slice(-4)}`;
}

function SectionPanel({
  title,
  subtitle,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className={`${cardClass} overflow-hidden`}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
        onClick={onToggle}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
            {badge ? <span className={countBadgeClass}>{badge}</span> : null}
          </div>
          {subtitle ? <p className={`mt-1 text-xs ${mutedClass}`}>{subtitle}</p> : null}
        </div>
        <span className={`mt-0.5 shrink-0 text-xs ${mutedClass}`}>{open ? "▲" : "▼"}</span>
      </button>
      {open ? <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">{children}</div> : null}
    </section>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): JSX.Element {
  return (
    <div className={`${panelClass} px-4 py-3`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide ${mutedClass}`}>{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
      {hint ? <p className={`mt-0.5 text-xs ${subtleClass}`}>{hint}</p> : null}
    </div>
  );
}

export function WaiterPage(): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const canManagePrinters = displayRole === "admin" || displayRole === "manager";
  const [tableId, setTableId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [printerRevision, setPrinterRevision] = useState(0);
  const [printerPanelOpen, setPrinterPanelOpen] = useState(false);
  const [waiterLoginsOpen, setWaiterLoginsOpen] = useState(true);
  const [waiterName, setWaiterName] = useState("");
  const [waiterEmail, setWaiterEmail] = useState("");
  const [waiterPassword, setWaiterPassword] = useState("");
  const [waiterPin, setWaiterPin] = useState("");
  const [editWaiterId, setEditWaiterId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPin, setEditPin] = useState("");

  const branchCode = branch?.code ?? "";
  const canManageWaiters = displayRole === "admin" || displayRole === "manager";

  useEffect(() => {
    if (!branchCode) return;
    setDrafts(loadDrafts(branchCode));
  }, [branchCode]);

  useEffect(() => {
    function refreshPrinters(event?: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }> | undefined)?.detail;
      if (!branchCode || !detail?.branchCode || detail.branchCode === branchCode) {
        setPrinterRevision((n) => n + 1);
      }
    }
    window.addEventListener(WAITER_PRINTER_SETTINGS_CHANGED_EVENT, refreshPrinters);
    window.addEventListener(PRINTER_ROUTING_CHANGED_EVENT, refreshPrinters);
    return () => {
      window.removeEventListener(WAITER_PRINTER_SETTINGS_CHANGED_EVENT, refreshPrinters);
      window.removeEventListener(PRINTER_ROUTING_CHANGED_EVENT, refreshPrinters);
    };
  }, [branchCode]);

  const receiptPrinterOptions = useMemo(() => {
    void printerRevision;
    return listPrintersByType(branchCode, "receipt");
  }, [branchCode, printerRevision]);

  const waitersQuery = useQuery({
    queryKey: ["billing", "waiters", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchWaiters(branchCode),
  });

  const createWaiterMutation = useMutation({
    mutationFn: () =>
      createWaiter({
        branchCode,
        name: waiterName.trim(),
        email: waiterEmail.trim(),
        password: waiterPassword,
        ...( /^\d{4}$/.test(waiterPin) ? { pin: waiterPin } : {} ),
      }),
    onSuccess: (waiter) => {
      const usedPin = /^\d{4}$/.test(waiterPin);
      const pinValue = waiterPin;
      setWaiterName("");
      setWaiterEmail("");
      setWaiterPassword("");
      setWaiterPin("");
      void queryClient.invalidateQueries({ queryKey: ["billing", "waiters"] });
      setNotice(
        usedPin
          ? `Mobile login created for ${waiter.name}. They can sign in with PIN ${pinValue} or ${waiter.email}.`
          : `Mobile login created for ${waiter.name}. They can sign in with ${waiter.email}. Add a 4-digit PIN for quicker login.`,
      );
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const updateWaiterMutation = useMutation({
    mutationFn: ({
      waiterId,
      email,
      password,
      pin,
    }: {
      waiterId: string;
      email: string;
      password: string;
      pin: string;
    }) =>
      updateWaiter(waiterId, {
        email: email.trim() || undefined,
        password: password || undefined,
        ...( /^\d{4}$/.test(pin) ? { pin } : {} ),
      }),
    onSuccess: (waiter) => {
      setEditWaiterId(null);
      setEditEmail("");
      setEditPassword("");
      setEditPin("");
      void queryClient.invalidateQueries({ queryKey: ["billing", "waiters"] });
      setNotice(`Login updated for ${waiter.name}.`);
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const waiters = waitersQuery.data ?? [];

  const floorQuery = useQuery({
    queryKey: ["tables", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchFloor(branchCode),
    refetchInterval: 15_000,
  });

  const floorTables = useMemo(
    () => (floorQuery.data?.tables ?? []).filter((t) => t.isActive),
    [floorQuery.data?.tables],
  );

  useEffect(() => {
    if (floorTables.length === 0) return;
    if (tableId && floorTables.some((t) => t.tableNumber === tableId)) return;
    const firstFree = floorTables.find((t) => t.bookingStatus !== "booked");
    setTableId(firstFree?.tableNumber ?? floorTables[0]?.tableNumber ?? null);
  }, [floorTables, tableId]);

  const selectedFloorTable = useMemo(
    () => floorTables.find((t) => t.tableNumber === tableId) ?? null,
    [floorTables, tableId],
  );
  const tableBookingStatus = selectedFloorTable?.bookingStatus === "booked" ? "booked" : "free";
  const tableBookedOrderRef = selectedFloorTable?.bookedOrderRef ?? null;

  const currentDraft = tableId
    ? (drafts[tableId] ?? {
        cart: [],
        notes: "",
        orderRef: newWaiterOrderRef(),
        waiterId: null,
      })
    : {
        cart: [] as CartLine[],
        notes: "",
        orderRef: newWaiterOrderRef(),
        waiterId: null as string | null,
      };

  const cart = currentDraft.cart;
  const notes = currentDraft.notes;
  const orderRef = currentDraft.orderRef;
  const waiterId = currentDraft.waiterId ?? waiters[0]?.id ?? null;
  const selectedWaiter = waiters.find((w) => w.id === waiterId) ?? null;
  const assignedPrinter = getWaiterPrinter(branchCode, waiterId);

  function updateDraft(patch: Partial<TableDraft>): void {
    if (!branchCode || !tableId) return;
    setDrafts((prev) => {
      const base = prev[tableId] ?? currentDraft;
      const next = { ...prev, [tableId]: { ...base, ...patch } };
      saveDrafts(branchCode, next);
      return next;
    });
  }

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

  const menuItems = menuQuery.data?.items.filter((m) => m.isActive) ?? [];

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems.slice(0, 12);
    return menuItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        formatMenuItemLabel(m).toLowerCase().includes(q),
    );
  }, [menuItems, search]);

  const tableKots = tableId
    ? (kitchenQuery.data ?? []).filter((k) => matchesTable(k.stationLabel, tableId))
    : [];

  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0);
  const service = Math.round(subtotal * (SERVICE_PCT / 100));
  const tax = Math.round((subtotal + service) * 0.15);
  const total = subtotal + service + tax;

  function tableIsBooked(tableNumber: string): boolean {
    return floorTables.find((t) => t.tableNumber === tableNumber)?.bookingStatus === "booked";
  }

  /** Booked tables cannot take a new waiter order until closed/completed. */
  const tableLocked = Boolean(tableId && tableIsBooked(tableId));

  function assertTableAvailableForNewOrder(): string | null {
    if (!tableId) return "Select a table first.";
    if (!tableLocked) return null;
    return tableBookedOrderRef
      ? `Table ${tableId} is booked by ${tableBookedOrderRef}. Close or complete that order before starting a new one.`
      : `Table ${tableId} is booked. Close or complete the current order before starting a new one.`;
  }

  const sendMutation = useMutation({
    mutationFn: () => {
      const lockErr = assertTableAvailableForNewOrder();
      if (lockErr) throw new Error(lockErr);
      if (!tableId) throw new Error("Select a table first.");
      return createKitchenTicket({
        branchCode: branchCode,
        orderRef,
        stationLabel: `Table ${tableId}`,
        notes: notes.trim() || undefined,
        lines: cart.map((line) => ({
          label: formatMenuItemLabel(line.item),
          qty: line.qty,
          menuItemId: line.item.id,
        })),
      });
    },
    onSuccess: async (ticket) => {
      const cartSnapshot = cart;
      if (branchCode && tableId) {
        saveLastOrder(branchCode, tableId, { cart: cartSnapshot, notes });
      }
      updateDraft({ cart: [], notes: "" });
      setShowMenu(false);
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });

      // Route KOT to assigned kitchen/bar printers (same model as POS).
      const asPosLines: PosCartLine[] = cartSnapshot.map((line, index) => ({
        key: `${line.item.id}-${index}`,
        item: line.item,
        variant: null,
        qty: line.qty,
        unitPrice: line.item.price,
        lineLabel: formatMenuItemLabel(line.item),
        sortOrder: line.sortOrder ?? index,
        isComplimentary: false,
      }));
      const enabledSections = loadPrinterSections(branchCode).filter((s) => s.enabled);
      const enabledIds = new Set(enabledSections.map((s) => s.id));
      const groups =
        enabledSections.length > 0
          ? groupCartLinesBySection(branchCode, asPosLines, enabledIds)
          : [{ sectionId: null as string | null, lines: asPosLines }];

      let printOk = true;
      const errors: string[] = [];
      for (const group of groups) {
        const section = group.sectionId
          ? enabledSections.find((s) => s.id === group.sectionId)
          : null;
        const preferredType =
          section?.name.toLowerCase().includes("bar") || section?.id.includes("bar")
            ? ("bar" as const)
            : ("kitchen" as const);
        const profile = resolveKotPrinter(branchCode, group.sectionId, waiterId, preferredType);
        const payload = withPrinterProfile(
          {
            branchName: branch?.name ?? "POPS",
            branchCode: branchCode || "—",
            orderRef: ticket.orderRef ?? ticket.ticketRef,
            modeLabel: "Dine-in",
            tableLabel: `Table ${tableId}`,
            waiterName: waiters.find((w) => w.id === waiterId)?.name,
            lines: [...group.lines]
              .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
              .map((l) => ({
                label: l.lineLabel,
                qty: l.qty,
                unitPrice: 0,
              })),
            subtotal: 0,
            discount: 0,
            service: 0,
            tax: 0,
            total: 0,
            servicePct: 0,
            discountPct: 0,
            printerName: section ? `${section.icon} ${section.name}` : "Kitchen",
          },
          profile,
        );
        const result = await printKotDetailed(payload);
        if (!result.ok) {
          printOk = false;
          errors.push(result.error ?? payload.printerName ?? "KOT");
        }
      }

      setNotice(
        printOk
          ? "Order sent to kitchen and printed."
          : `Order sent to kitchen, but print failed — ${errors.join("; ")}. Check Printer Assign Users.`,
      );
    },
    onError: (err: Error) => setNotice(err.message),
  });

  function addToCart(item: ApiMenuItem): void {
    const sortOrder = nextWaiterCartSortOrder(cart);
    const i = cart.findIndex((l) => l.item.id === item.id);
    if (i >= 0) {
      const updated = { ...cart[i], qty: cart[i].qty + 1, sortOrder };
      updateDraft({ cart: sortWaiterCart(cart.map((l, idx) => (idx === i ? updated : l))) });
    } else {
      updateDraft({ cart: sortWaiterCart([{ item, qty: 1, sortOrder }, ...cart]) });
    }
    setNotice(null);
  }

  function setLineQty(itemId: string, qty: number): void {
    const next =
      qty <= 0
        ? cart.filter((l) => l.item.id !== itemId)
        : cart.map((l) => {
            if (l.item.id !== itemId) return l;
            const sortOrder = qty > l.qty ? nextWaiterCartSortOrder(cart) : l.sortOrder;
            return { ...l, qty, sortOrder };
          });
    updateDraft({ cart: sortWaiterCart(next) });
  }

  function reorderLast(): void {
    if (!branchCode || !tableId) return;
    const lockErr = assertTableAvailableForNewOrder();
    if (lockErr) {
      setNotice(lockErr);
      return;
    }
    const last = loadLastOrder(branchCode, tableId);
    if (!last || last.cart.length === 0) {
      setNotice("No previous order for this table.");
      return;
    }
    updateDraft({ cart: last.cart, notes: last.notes });
    setNotice("Loaded last order — review and send to kitchen.");
  }

  const createBillMutation = useMutation({
    mutationFn: () => {
      const lockErr = assertTableAvailableForNewOrder();
      if (lockErr) throw new Error(lockErr);
      if (!tableId) throw new Error("Select a table first.");
      return createBill({
        branchCode,
        orderRef,
        tableLabel: `Table ${tableId}`,
        waiterId: waiterId!,
        lines: cart.map((line) => ({
          label: formatMenuItemLabel(line.item),
          qty: line.qty,
          unitPrice: line.item.price,
          menuItemId: line.item.id,
        })),
        notes: notes.trim() || undefined,
        servicePct: SERVICE_PCT,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err: Error) => setNotice(err.message),
  });

  async function createAndPrintBill(): Promise<void> {
    if (!tableId) {
      setNotice("Select a table first.");
      return;
    }
    if (cart.length === 0) {
      setNotice("Add items before creating a bill.");
      return;
    }
    if (!waiterId) {
      setNotice("Select a waiter for this bill.");
      return;
    }
    const lockErr = assertTableAvailableForNewOrder();
    if (lockErr) {
      setNotice(lockErr);
      return;
    }
    try {
      const bill = await createBillMutation.mutateAsync();
      const profile = resolveReceiptPrinter(branchCode, waiterId);
      const assigned = getWaiterPrinter(branchCode, waiterId);
      const payload: Omit<PrintTicketInput, "kind"> = withPrinterProfile(
        {
          ...billToPrintInput(branch?.name ?? "POPS", branchCode || "—", bill),
          printerName: profile?.name ?? assigned?.printerName,
          systemPrinterName: profile?.systemPrinterName ?? assigned?.systemPrinterName,
        },
        profile,
      );
      const ok = await printReceiptAsync(payload);
      const target = payload.systemPrinterName ?? payload.printerName;
      if (ok) {
        updateDraft({ cart: [], notes: "" });
        setNotice(
          target
            ? `Bill ${bill.billRef} created for ${bill.waiterName} — printing to ${target}.`
            : `Bill ${bill.billRef} created for ${bill.waiterName} — sent to printer.`,
        );
      } else {
        setNotice(`Bill ${bill.billRef} created but print failed.`);
      }
    } catch {
      /* error handled in mutation */
    }
  }

  function transferTo(targetId: string): void {
    if (!tableId || targetId === tableId) {
      setTransferOpen(false);
      return;
    }
    if (!branchCode) return;
    if (tableIsBooked(targetId)) {
      const target = floorTables.find((t) => t.tableNumber === targetId);
      setNotice(
        target?.bookedOrderRef
          ? `Table ${targetId} is booked by ${target.bookedOrderRef}. Close or complete that order first.`
          : `Table ${targetId} is booked. Close or complete the current order first.`,
      );
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      const source = next[tableId] ?? currentDraft;
      const dest = next[targetId] ?? {
        cart: [],
        notes: "",
        orderRef: newWaiterOrderRef(),
        waiterId: null,
      };
      next[targetId] = {
        ...dest,
        cart: [...dest.cart, ...source.cart],
        notes: [dest.notes, source.notes].filter(Boolean).join(" · "),
        waiterId: source.waiterId ?? dest.waiterId,
      };
      next[tableId] = { ...source, cart: [], notes: "" };
      saveDrafts(branchCode, next);
      return next;
    });
    setTableId(targetId);
    setTransferOpen(false);
    setNotice(`Moved order to Table ${targetId}.`);
  }

  if (!branchCode) {
    return <PageHeader title="Waiter" subtitle="Select a branch to manage table service." />;
  }

  const tablesWithOrders = floorTables.filter((t) => (drafts[t.tableNumber]?.cart.length ?? 0) > 0).length;
  const bookedCount = floorTables.filter((t) => t.bookingStatus === "booked").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <PageHeader
        title="Waiter"
        subtitle="Table service, kitchen tickets, and mobile staff logins for this branch."
        actions={
          <Button
            type="button"
            variant={transferOpen ? "primary" : "ghost"}
            className="text-xs"
            onClick={() => setTransferOpen((v) => !v)}
          >
            {transferOpen ? "Close transfer" : "Transfer table"}
          </Button>
        }
      />

      {notice ? (
        <div className={`${noticeSuccessClass} flex items-start justify-between gap-3`}>
          <p>{notice}</p>
          <button
            type="button"
            className={`shrink-0 text-xs ${mutedClass} hover:text-slate-900 dark:hover:text-white`}
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Branch" value={branch?.name ?? branchCode} hint={branchCode} />
        <StatTile
          label="Waiters"
          value={waitersQuery.isLoading ? "…" : String(waiters.length)}
          hint="Mobile + floor staff"
        />
        <StatTile
          label="Active table"
          value={tableId ?? "—"}
          hint={
            tableId
              ? tableBookedOrderRef
                ? `${tableBookingStatus} · ${tableBookedOrderRef}`
                : tableBookingStatus
              : "Select a table"
          }
        />
        <StatTile
          label="Order total"
          value={cart.length > 0 ? `Rs ${total.toLocaleString()}` : "—"}
          hint={
            cart.length > 0
              ? `${cart.length} item${cart.length === 1 ? "" : "s"}`
              : `${bookedCount} table${bookedCount === 1 ? "" : "s"} booked`
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {(canManageWaiters || (canManagePrinters && waiters.length > 0)) ? (
          <div className="space-y-4 lg:col-span-4">
            {canManageWaiters ? (
              <SectionPanel
                title="Mobile waiter logins"
                subtitle="Credentials for the POPS Staff mobile app"
                badge={String(waiters.length)}
                open={waiterLoginsOpen}
                onToggle={() => setWaiterLoginsOpen((v) => !v)}
              >
                <div className="space-y-4">
                  <div className={`${panelClass} space-y-3 p-4`}>
                    <div className={panelTitleClass}>Add waiter login</div>
                    <p className={`text-xs ${mutedClass}`}>
                      Waiters sign in on the mobile app with a 4-digit PIN (recommended) or email and
                      password.
                    </p>
                    <div className="grid gap-3">
                      <input
                        placeholder="Display name *"
                        value={waiterName}
                        onChange={(e) => setWaiterName(e.target.value)}
                        className={fieldInputClass}
                      />
                      <input
                        type="email"
                        placeholder="Login email *"
                        value={waiterEmail}
                        onChange={(e) => setWaiterEmail(e.target.value)}
                        className={fieldInputClass}
                      />
                      <input
                        type="password"
                        placeholder="Password * (min 8 characters)"
                        value={waiterPassword}
                        onChange={(e) => setWaiterPassword(e.target.value)}
                        className={fieldInputClass}
                      />
                      <input
                        inputMode="numeric"
                        placeholder="4-digit PIN * (mobile quick login)"
                        value={waiterPin}
                        onChange={(e) => setWaiterPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className={fieldInputClass}
                        maxLength={4}
                      />
                    </div>
                    <Button
                      type="button"
                      className="h-9 w-full text-xs"
                      disabled={
                        !waiterName.trim() ||
                        !waiterEmail.trim() ||
                        waiterPassword.length < 8 ||
                        !/^\d{4}$/.test(waiterPin) ||
                        createWaiterMutation.isPending
                      }
                      onClick={() => createWaiterMutation.mutate()}
                    >
                      {createWaiterMutation.isPending ? "Creating…" : "Create mobile login"}
                    </Button>
                  </div>

                  {waitersQuery.isLoading ? (
                    <p className={`text-xs ${mutedClass}`}>Loading waiters…</p>
                  ) : waiters.length === 0 ? (
                    <p className={`rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-xs ${mutedClass} dark:border-slate-700`}>
                      No waiter logins yet. Create one above.
                    </p>
                  ) : (
                    <SimpleTable
                      rowKey={(w) => w.id}
                      rows={waiters}
                      columns={[
                        {
                          key: "name",
                          header: "Name",
                          render: (w) => <span className="font-medium text-slate-900 dark:text-white">{w.name}</span>,
                        },
                        {
                          key: "email",
                          header: "Email",
                          render: (w) => <span className={mutedClass}>{w.email}</span>,
                        },
                        {
                          key: "actions",
                          header: "",
                          id: "actions",
                          render: (w) => (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => {
                                setEditWaiterId(w.id);
                                setEditEmail(w.email);
                                setEditPassword("");
                                setEditPin("");
                              }}
                            >
                              Edit
                            </Button>
                          ),
                        },
                      ]}
                    />
                  )}

                  {editWaiterId ? (
                    <div className={`${panelClass} space-y-3 p-4`}>
                      <div className={panelTitleClass}>Update login & PIN</div>
                      <p className={`text-xs ${mutedClass}`}>
                        Change email, password, or set a new 4-digit PIN for the waiter app.
                      </p>
                      <input
                        type="email"
                        placeholder="Login email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className={fieldInputClass}
                      />
                      <input
                        type="password"
                        placeholder="New password (optional, min 8 chars)"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className={fieldInputClass}
                      />
                      <input
                        inputMode="numeric"
                        placeholder="New 4-digit PIN (optional)"
                        value={editPin}
                        onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className={fieldInputClass}
                        maxLength={4}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="h-8 flex-1 text-xs"
                          disabled={
                            (!editEmail.trim() && editPassword.length === 0 && editPin.length === 0) ||
                            (editPassword.length > 0 && editPassword.length < 8) ||
                            (editPin.length > 0 && editPin.length !== 4) ||
                            updateWaiterMutation.isPending
                          }
                          onClick={() =>
                            updateWaiterMutation.mutate({
                              waiterId: editWaiterId,
                              email: editEmail,
                              password: editPassword,
                              pin: editPin,
                            })
                          }
                        >
                          {updateWaiterMutation.isPending ? "Saving…" : "Save changes"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={() => {
                            setEditWaiterId(null);
                            setEditEmail("");
                            setEditPassword("");
                            setEditPin("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </SectionPanel>
            ) : null}

            {canManagePrinters && waiters.length > 0 ? (
              <SectionPanel
                title="Printer assignments"
                subtitle="Pick printer by waiter name — each waiter prints to their own receipt printer"
                open={printerPanelOpen}
                onToggle={() => setPrinterPanelOpen((v) => !v)}
              >
                <div className="space-y-3">
                  {receiptPrinterOptions.length === 0 ? (
                    <p className={`text-xs ${mutedClass}`}>
                      No receipt printer profiles yet. Add them under Printer → Printer Profiles, then assign here by
                      waiter name.
                    </p>
                  ) : null}
                  {waiters.map((w) => {
                    void printerRevision;
                    const assignedIds = getPrintersForUser(branchCode, w.id)
                      .filter((p) => p.printerType === "receipt")
                      .map((p) => p.id);
                    const currentId = assignedIds[0] ?? "";
                    const current = getWaiterPrinter(branchCode, w.id);
                    return (
                      <label key={w.id} className={`block text-xs ${mutedClass}`}>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{w.name}</span>
                        <select
                          className={`mt-1.5 ${fieldSelectClass}`}
                          value={currentId}
                          onChange={(e) => {
                            if (!branchCode) return;
                            const printerId = e.target.value || null;
                            setUserPrinterForType(branchCode, w.id, "receipt", printerId);
                            const profile = receiptPrinterOptions.find((p) => p.id === printerId);
                            // Keep legacy map in sync for older reprint paths (OS name only).
                            setWaiterPrinter(
                              branchCode,
                              w.id,
                              profile?.systemPrinterName?.trim() || "",
                            );
                            setNotice(
                              printerId
                                ? `${w.name} → ${profile?.name ?? "printer"}`
                                : `${w.name} printer cleared`,
                            );
                          }}
                        >
                          <option value="">Branch default / unassigned</option>
                          {receiptPrinterOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.systemPrinterName ? ` · ${p.systemPrinterName}` : ""}
                              {p.assignedCounter ? ` · ${p.assignedCounter}` : ""}
                            </option>
                          ))}
                        </select>
                        {current?.printerName ? (
                          <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">
                            Active: {current.printerName}
                            {current.systemPrinterName && current.systemPrinterName !== current.printerName
                              ? ` (${current.systemPrinterName})`
                              : ""}
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </SectionPanel>
            ) : null}
          </div>
        ) : null}

        <div
          className={
            canManageWaiters || (canManagePrinters && waiters.length > 0)
              ? "space-y-4 lg:col-span-8"
              : "space-y-4 lg:col-span-12"
          }
        >
          {transferOpen ? (
            <div className={`${cardClass} p-4`}>
              <p className={`text-sm font-medium text-slate-900 dark:text-white`}>
                Transfer order from {tableId ? `Table ${tableId}` : "—"}
              </p>
              <p className={`mt-1 text-xs ${mutedClass}`}>
                Select a free destination table. Booked tables stay locked until closed.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {floorTables
                  .filter((t) => t.tableNumber !== tableId)
                  .map((t) => {
                    const booked = t.bookingStatus === "booked";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={booked}
                        onClick={() => transferTo(t.tableNumber)}
                        title={
                          booked
                            ? t.bookedOrderRef
                              ? `Booked · ${t.bookedOrderRef}`
                              : "Booked"
                            : undefined
                        }
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          booked
                            ? "cursor-not-allowed border-red-300/60 bg-red-50 text-red-700 opacity-60 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200"
                            : pillInactiveClass
                        }`}
                      >
                        {t.tableNumber}
                        {booked ? " · booked" : ""}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div className={`${cardClass} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Assigned waiter</h2>
                <p className={`mt-1 text-xs ${mutedClass}`}>Who is serving the current table order</p>
              </div>
              {selectedWaiter ? (
                <Badge tone="info">{selectedWaiter.name}</Badge>
              ) : null}
            </div>
            {waitersQuery.isLoading ? (
              <p className={`mt-3 text-xs ${mutedClass}`}>Loading waiters…</p>
            ) : waiters.length === 0 ? (
              <p className={`mt-3 text-xs text-amber-800 dark:text-amber-200/90`}>
                No waiters for this branch. Create mobile logins in the panel on the left.
              </p>
            ) : (
              <select
                className={`mt-3 w-full ${fieldSelectClass}`}
                value={waiterId ?? ""}
                onChange={(e) => updateDraft({ waiterId: e.target.value || null })}
              >
                <option value="">Select waiter…</option>
                {waiters.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.email})
                  </option>
                ))}
              </select>
            )}
            {selectedWaiter ? (
              <p className={`mt-2 text-xs ${mutedClass}`}>
                {assignedPrinter ? (
                  <>
                    Printer: <span className="text-amber-700 dark:text-amber-300">{assignedPrinter.printerName}</span>
                  </>
                ) : (
                  "No receipt printer assigned"
                )}
              </p>
            ) : null}
          </div>

          <div className={`${cardClass} p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Floor tables</h2>
                <p className={`mt-1 text-xs ${mutedClass}`}>
                  {bookedCount} booked · {tablesWithOrders} with open drafts
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge tone={tableStatusTone(tableBookingStatus)}>{tableBookingStatus}</Badge>
                <span className={`font-mono ${mutedClass}`}>{orderRef}</span>
              </div>
            </div>
            {tableLocked ? (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                {tableBookedOrderRef
                  ? `Table ${tableId} is booked by ${tableBookedOrderRef}. Close or complete that order before starting a new one.`
                  : `Table ${tableId} is booked. Close or complete the current order before starting a new one.`}
              </p>
            ) : null}
            {floorQuery.isLoading ? (
              <p className={`mt-4 text-xs ${mutedClass}`}>Loading floor plan…</p>
            ) : floorTables.length === 0 ? (
              <p className={`mt-4 text-xs ${mutedClass}`}>
                No tables yet. Add them under Tables.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {floorTables.map((t) => {
                  const active = tableId === t.tableNumber;
                  const hasDraft = (drafts[t.tableNumber]?.cart.length ?? 0) > 0;
                  const booked = t.bookingStatus === "booked";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTableId(t.tableNumber);
                        setShowMenu(false);
                        setNotice(
                          booked && t.bookedOrderRef
                            ? `Table ${t.tableNumber} is booked by ${t.bookedOrderRef}.`
                            : booked
                              ? `Table ${t.tableNumber} is booked.`
                              : null,
                        );
                      }}
                      title={
                        booked
                          ? t.bookedOrderRef
                            ? `Booked · ${t.bookedOrderRef}`
                            : "Booked"
                          : `${t.seats} seats`
                      }
                      className={[
                        "relative rounded-xl border px-3 py-3 text-center transition",
                        active
                          ? amberPillActiveClass
                          : booked
                            ? "border-red-300/70 bg-red-50 hover:border-red-400 dark:border-red-500/40 dark:bg-red-950/40 dark:hover:border-red-400/60"
                            : "border-slate-200 bg-white hover:border-amber-500/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-amber-500/30",
                      ].join(" ")}
                    >
                      <span className="text-sm font-semibold">{t.tableNumber}</span>
                      <span
                        className={`mt-1 block text-[10px] font-medium uppercase tracking-wide ${
                          booked
                            ? "text-red-600 dark:text-red-300"
                            : hasDraft
                              ? "text-amber-700 dark:text-amber-300"
                              : mutedClass
                        }`}
                      >
                        {booked ? "Booked" : hasDraft ? "Draft" : "Free"}
                      </span>
                      {booked || hasDraft ? (
                        <span
                          className={[
                            "absolute right-2 top-2 h-2 w-2 rounded-full",
                            booked ? "bg-red-500" : "bg-amber-500",
                          ].join(" ")}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Order · {tableId ? `Table ${tableId}` : "—"}
                  </h2>
                  <p className={`mt-1 text-xs ${mutedClass}`}>Build the ticket and send to kitchen</p>
                </div>
                {cart.length > 0 ? (
                  <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                    Rs {subtotal.toLocaleString()}
                  </span>
                ) : null}
              </div>

              {cart.length > 0 ? (
                <ul className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {sortWaiterCart(cart).map((line) => (
                    <li
                      key={line.item.id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950/50"
                    >
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-900 dark:text-white">
                          {formatMenuItemLabel(line.item)}
                        </p>
                        <p className={`mt-1 text-[10px] tabular-nums ${mutedClass}`}>
                          Rs {(line.item.price * line.qty).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-900">
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                          onClick={() => setLineQty(line.item.id, line.qty - 1)}
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-[11px] tabular-nums">{line.qty}</span>
                        <button
                          type="button"
                          className="h-6 w-6 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                          onClick={() => setLineQty(line.item.id, line.qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-xs ${mutedClass} dark:border-slate-700`}>
                  No items yet. Add menu items to start the order.
                </p>
              )}

              <textarea
                className={`mt-4 w-full ${fieldInputClass}`}
                rows={3}
                placeholder="Customer notes, modifiers, allergies…"
                value={notes}
                onChange={(e) => updateDraft({ notes: e.target.value })}
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="text-xs"
                  disabled={tableLocked}
                  onClick={() => setShowMenu((v) => !v)}
                >
                  {showMenu ? "Hide menu" : "Add items"}
                </Button>
                <Button
                  type="button"
                  className="text-xs"
                  disabled={cart.length === 0 || sendMutation.isPending || tableLocked || !tableId}
                  onClick={() => sendMutation.mutate()}
                >
                  {sendMutation.isPending ? "Sending…" : "Send to kitchen"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs"
                  disabled={tableLocked || !tableId}
                  onClick={reorderLast}
                >
                  Reorder last
                </Button>
              </div>

              {showMenu ? (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <input
                    className={`w-full ${fieldInputClass}`}
                    placeholder="Search menu…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {menuQuery.isLoading ? <p className={`mt-2 text-xs ${mutedClass}`}>Loading menu…</p> : null}
                  <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto">
                    {filteredMenu.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addToCart(item)}
                        className="flex w-full items-center justify-between rounded-lg border border-transparent bg-slate-50 px-3 py-2.5 text-left text-sm transition hover:border-amber-500/30 hover:bg-amber-50 dark:bg-slate-950/50 dark:hover:bg-slate-800/80"
                      >
                        <span className="text-slate-800 dark:text-slate-200">{formatMenuItemLabel(item)}</span>
                        <span className="text-xs font-medium tabular-nums text-amber-700 dark:text-amber-300">
                          Rs {item.price.toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`${cardClass} p-4`}>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Kitchen status</h2>
                <p className={`mt-1 text-xs ${mutedClass}`}>
                  Live tickets for {tableId ? `Table ${tableId}` : "this table"}
                </p>
              </div>

              {kitchenQuery.isLoading ? (
                <p className={`mt-4 text-xs ${mutedClass}`}>Loading kitchen tickets…</p>
              ) : tableKots.length === 0 ? (
                <p className={`mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-xs ${mutedClass} dark:border-slate-700`}>
                  No active kitchen ticket for this table.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {tableKots.map((k) => (
                    <li
                      key={k.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-950/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                          {k.ticketRef}
                        </span>
                        <Badge
                          tone={
                            k.status === "ready" ? "success" : k.status === "cooking" ? "info" : "warning"
                          }
                        >
                          {k.status}
                        </Badge>
                      </div>
                      <p className={`mt-2 text-xs ${mutedClass}`}>{k.itemsSummary}</p>
                      <p className={`mt-1 text-[11px] ${subtleClass}`}>{k.mins} min elapsed</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs">
                  <span className={mutedClass}>Subtotal</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">Rs {subtotal.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={mutedClass}>Service ({SERVICE_PCT}%)</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">Rs {service.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className={mutedClass}>Tax (15%)</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">Rs {tax.toLocaleString()}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold dark:border-slate-700">
                  <span className="text-slate-900 dark:text-white">Total</span>
                  <span className="tabular-nums text-amber-700 dark:text-amber-300">
                    Rs {total.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                className="mt-4 h-10 w-full text-sm"
                disabled={
                  cart.length === 0 ||
                  !waiterId ||
                  !tableId ||
                  tableLocked ||
                  createBillMutation.isPending
                }
                onClick={() => void createAndPrintBill()}
              >
                {createBillMutation.isPending
                  ? "Creating bill…"
                  : cart.length > 0
                    ? `Create bill · Rs ${total.toLocaleString()}`
                    : "Create bill"}
              </Button>
              <p className={`mt-2 text-center text-[11px] ${mutedClass}`}>
                Saves bill with waiter name and opens print dialog
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
