import { Button } from "@platform/ui";
import { formatMenuItemLabel, type MenuItem as ApiMenuItem } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import { createBill, createWaiter, fetchWaiters, updateWaiter } from "../../api/billing";
import { fetchKitchenTickets, createKitchenTicket } from "../../api/kitchen";
import { fetchBranchMenu } from "../../api/menu";
import { tables } from "../../data/fixtures";
import { printReceipt, billToPrintInput, type PrintTicketInput } from "../../lib/printTicket";
import {
  getWaiterPrinter,
  loadWaiterPrinterMap,
  setWaiterPrinter,
  WAITER_PRINTER_PRESETS,
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

function matchesTable(stationLabel: string, tableId: string): boolean {
  const label = stationLabel.trim().toLowerCase();
  const t = tableId.toLowerCase();
  return label === t || label === `table ${t}` || label.endsWith(` ${t}`);
}

function tableStatusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "free") return "success";
  if (status === "billing") return "warning";
  return "info";
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
  const [tableId, setTableId] = useState("T1");
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [printerMap, setPrinterMap] = useState<Record<string, { printerName: string }>>({});
  const [printerPanelOpen, setPrinterPanelOpen] = useState(false);
  const [waiterLoginsOpen, setWaiterLoginsOpen] = useState(true);
  const [waiterName, setWaiterName] = useState("");
  const [waiterEmail, setWaiterEmail] = useState("");
  const [waiterPassword, setWaiterPassword] = useState("");
  const [waiterPin, setWaiterPin] = useState("");
  const [editWaiterId, setEditWaiterId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const branchCode = branch?.code ?? "";
  const canManageWaiters = displayRole === "admin" || displayRole === "manager";

  useEffect(() => {
    if (!branchCode) return;
    setDrafts(loadDrafts(branchCode));
    setPrinterMap(loadWaiterPrinterMap(branchCode));
  }, [branchCode]);

  useEffect(() => {
    function onPrinterSettingsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branchCode || detail?.branchCode === branchCode) {
        setPrinterMap(loadWaiterPrinterMap(branchCode));
      }
    }
    window.addEventListener(WAITER_PRINTER_SETTINGS_CHANGED_EVENT, onPrinterSettingsChanged);
    return () => window.removeEventListener(WAITER_PRINTER_SETTINGS_CHANGED_EVENT, onPrinterSettingsChanged);
  }, [branchCode]);

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
      setWaiterName("");
      setWaiterEmail("");
      setWaiterPassword("");
      setWaiterPin("");
      void queryClient.invalidateQueries({ queryKey: ["billing", "waiters"] });
      setNotice(`Mobile login created for ${waiter.name}. They can sign in with ${waiter.email}.`);
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const updateWaiterMutation = useMutation({
    mutationFn: ({ waiterId, email, password }: { waiterId: string; email: string; password: string }) =>
      updateWaiter(waiterId, {
        email: email.trim() || undefined,
        password: password || undefined,
      }),
    onSuccess: (waiter) => {
      setEditWaiterId(null);
      setEditEmail("");
      setEditPassword("");
      void queryClient.invalidateQueries({ queryKey: ["billing", "waiters"] });
      setNotice(`Login updated for ${waiter.name}.`);
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const waiters = waitersQuery.data ?? [];

  const currentDraft = drafts[tableId] ?? {
    cart: [],
    notes: "",
    orderRef: tables.find((t) => t.id === tableId)?.order ?? `ORD-${Date.now().toString().slice(-4)}`,
    waiterId: null,
  };

  const cart = currentDraft.cart;
  const notes = currentDraft.notes;
  const orderRef = currentDraft.orderRef;
  const waiterId = currentDraft.waiterId ?? waiters[0]?.id ?? null;
  const selectedWaiter = waiters.find((w) => w.id === waiterId) ?? null;
  const assignedPrinter = getWaiterPrinter(branchCode, waiterId);

  function updateDraft(patch: Partial<TableDraft>): void {
    if (!branchCode) return;
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

  const tableKots = (kitchenQuery.data ?? []).filter((k) => matchesTable(k.stationLabel, tableId));

  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0);
  const service = Math.round(subtotal * (SERVICE_PCT / 100));
  const tax = Math.round((subtotal + service) * 0.15);
  const total = subtotal + service + tax;

  const sendMutation = useMutation({
    mutationFn: () =>
      createKitchenTicket({
        branchCode: branchCode,
        orderRef,
        stationLabel: tableId,
        notes: notes.trim() || undefined,
        lines: cart.map((line) => ({
          label: formatMenuItemLabel(line.item),
          qty: line.qty,
          menuItemId: line.item.id,
        })),
      }),
    onSuccess: () => {
      if (branchCode) {
        saveLastOrder(branchCode, tableId, { cart, notes });
      }
      updateDraft({ cart: [], notes: "" });
      setShowMenu(false);
      void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      setNotice("Order sent to kitchen.");
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
    if (!branchCode) return;
    const last = loadLastOrder(branchCode, tableId);
    if (!last || last.cart.length === 0) {
      setNotice("No previous order for this table.");
      return;
    }
    updateDraft({ cart: last.cart, notes: last.notes });
    setNotice("Loaded last order — review and send to kitchen.");
  }

  const createBillMutation = useMutation({
    mutationFn: () =>
      createBill({
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
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err: Error) => setNotice(err.message),
  });

  async function createAndPrintBill(): Promise<void> {
    if (cart.length === 0) {
      setNotice("Add items before creating a bill.");
      return;
    }
    if (!waiterId) {
      setNotice("Select a waiter for this bill.");
      return;
    }
    try {
      const bill = await createBillMutation.mutateAsync();
      const printerName = getWaiterPrinter(branchCode, waiterId)?.printerName;
      const payload: Omit<PrintTicketInput, "kind"> = {
        ...billToPrintInput(branch?.name ?? "POPS", branchCode || "—", bill),
        printerName,
      };
      const ok = printReceipt(payload);
      if (ok) {
        updateDraft({ cart: [], notes: "" });
        setNotice(
          printerName
            ? `Bill ${bill.billRef} created for ${bill.waiterName} — printing to ${printerName}.`
            : `Bill ${bill.billRef} created for ${bill.waiterName} — sent to printer.`,
        );
      } else {
        setNotice(`Bill ${bill.billRef} created but print dialog failed.`);
      }
    } catch {
      /* error handled in mutation */
    }
  }

  function transferTo(targetId: string): void {
    if (targetId === tableId) {
      setTransferOpen(false);
      return;
    }
    if (!branchCode) return;
    setDrafts((prev) => {
      const next = { ...prev };
      const source = next[tableId] ?? currentDraft;
      const dest = next[targetId] ?? {
        cart: [],
        notes: "",
        orderRef: tables.find((t) => t.id === targetId)?.order ?? `ORD-${Date.now().toString().slice(-4)}`,
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
    setNotice(`Moved order to ${targetId}.`);
  }

  if (!branchCode) {
    return <PageHeader title="Waiter" subtitle="Select a branch to manage table service." />;
  }

  const currentTable = tables.find((t) => t.id === tableId);
  const tablesWithOrders = tables.filter((t) => (drafts[t.id]?.cart.length ?? 0) > 0).length;

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
          value={tableId}
          hint={currentTable?.status ?? "free"}
        />
        <StatTile
          label="Order total"
          value={cart.length > 0 ? `Rs ${total.toLocaleString()}` : "—"}
          hint={cart.length > 0 ? `${cart.length} item${cart.length === 1 ? "" : "s"}` : "No items in cart"}
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
                      Waiters sign in on the mobile app with PIN or email and password.
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
                        placeholder="4-digit PIN (optional, for mobile quick login)"
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
                      <div className={panelTitleClass}>Update login</div>
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
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="h-8 flex-1 text-xs"
                          disabled={
                            (!editEmail.trim() && editPassword.length === 0) ||
                            (editPassword.length > 0 && editPassword.length < 8) ||
                            updateWaiterMutation.isPending
                          }
                          onClick={() =>
                            updateWaiterMutation.mutate({
                              waiterId: editWaiterId,
                              email: editEmail,
                              password: editPassword,
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
                subtitle="Receipt printer per waiter"
                open={printerPanelOpen}
                onToggle={() => setPrinterPanelOpen((v) => !v)}
              >
                <div className="space-y-3">
                  <datalist id="waiter-printer-presets">
                    {WAITER_PRINTER_PRESETS.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {waiters.map((w) => (
                    <label key={w.id} className={`block text-xs ${mutedClass}`}>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{w.name}</span>
                      <input
                        list="waiter-printer-presets"
                        className={`mt-1.5 ${fieldInputClass}`}
                        placeholder="e.g. Waiter station 2"
                        value={printerMap[w.id]?.printerName ?? ""}
                        onChange={(e) => {
                          setPrinterMap((prev) => ({ ...prev, [w.id]: { printerName: e.target.value } }));
                        }}
                        onBlur={(e) => {
                          if (!branchCode) return;
                          setWaiterPrinter(branchCode, w.id, e.target.value);
                        }}
                      />
                    </label>
                  ))}
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
                Transfer order from {tableId}
              </p>
              <p className={`mt-1 text-xs ${mutedClass}`}>Select the destination table.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tables
                  .filter((t) => t.id !== tableId)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => transferTo(t.id)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${pillInactiveClass}`}
                    >
                      {t.id}
                    </button>
                  ))}
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
                  {tablesWithOrders} table{tablesWithOrders === 1 ? "" : "s"} with open orders
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Badge tone={tableStatusTone(currentTable?.status ?? "free")}>
                  {currentTable?.status ?? "free"}
                </Badge>
                <span className={`font-mono ${mutedClass}`}>{orderRef}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {tables.map((t) => {
                const active = tableId === t.id;
                const hasDraft = (drafts[t.id]?.cart.length ?? 0) > 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTableId(t.id);
                      setShowMenu(false);
                      setNotice(null);
                    }}
                    className={[
                      "relative rounded-xl border px-3 py-3 text-center transition",
                      active
                        ? amberPillActiveClass
                        : "border-slate-200 bg-white hover:border-amber-500/40 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-amber-500/30",
                    ].join(" ")}
                  >
                    <span className="text-sm font-semibold">{t.id}</span>
                    {t.status !== "free" || hasDraft ? (
                      <span
                        className={[
                          "absolute right-2 top-2 h-2 w-2 rounded-full",
                          hasDraft ? "bg-amber-500" : "bg-sky-500",
                        ].join(" ")}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className={`${cardClass} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Order · {tableId}</h2>
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
                <Button type="button" className="text-xs" onClick={() => setShowMenu((v) => !v)}>
                  {showMenu ? "Hide menu" : "Add items"}
                </Button>
                <Button
                  type="button"
                  className="text-xs"
                  disabled={cart.length === 0 || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  {sendMutation.isPending ? "Sending…" : "Send to kitchen"}
                </Button>
                <Button type="button" variant="ghost" className="text-xs" onClick={reorderLast}>
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
                <p className={`mt-1 text-xs ${mutedClass}`}>Live tickets for {tableId}</p>
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
                disabled={cart.length === 0 || !waiterId || createBillMutation.isPending}
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
