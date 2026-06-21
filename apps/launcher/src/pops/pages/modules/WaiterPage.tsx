import { Button } from "@platform/ui";
import { formatMenuItemLabel, type MenuItem as ApiMenuItem } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import { createBill, fetchWaiters } from "../../api/billing";
import { createKitchenTicket, fetchKitchenTickets } from "../../api/kitchen";
import { fetchBranchMenu } from "../../api/menu";
import { tables } from "../../data/fixtures";
import { printReceipt, type PrintTicketInput } from "../../lib/printTicket";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";

type CartLine = { item: ApiMenuItem; qty: number };

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

export function WaiterPage(): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const [tableId, setTableId] = useState("T1");
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const branchCode = branch?.code ?? "";

  useEffect(() => {
    if (!branchCode) return;
    setDrafts(loadDrafts(branchCode));
  }, [branchCode]);

  const waitersQuery = useQuery({
    queryKey: ["billing", "waiters"],
    enabled: Boolean(branchCode),
    queryFn: () => fetchWaiters(),
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
    const next = [...cart];
    const i = next.findIndex((l) => l.item.id === item.id);
    if (i >= 0) next[i] = { ...next[i], qty: next[i].qty + 1 };
    else next.push({ item, qty: 1 });
    updateDraft({ cart: next });
    setNotice(null);
  }

  function setLineQty(itemId: string, qty: number): void {
    const next = qty <= 0 ? cart.filter((l) => l.item.id !== itemId) : cart.map((l) => (l.item.id === itemId ? { ...l, qty } : l));
    updateDraft({ cart: next });
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
      const payload: Omit<PrintTicketInput, "kind"> = {
        branchName: branch?.name ?? "POPS",
        branchCode: branchCode || "—",
        orderRef: bill.orderRef ?? orderRef,
        billRef: bill.billRef,
        modeLabel: "Dine-in",
        tableLabel: bill.tableLabel,
        waiterName: bill.waiterName,
        lines: bill.lines.map((line) => ({
          label: line.label,
          qty: line.qty,
          unitPrice: line.unitPrice,
        })),
        subtotal: bill.subtotal,
        discount: bill.discount,
        service: bill.service,
        tax: bill.tax,
        total: bill.total,
        servicePct: SERVICE_PCT,
        discountPct: 0,
      };
      const ok = printReceipt(payload);
      if (ok) {
        updateDraft({ cart: [], notes: "" });
        setNotice(`Bill ${bill.billRef} created for ${bill.waiterName} — sent to printer.`);
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

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader
        title="Waiter"
        subtitle="Table service, send to kitchen, track status, request bill."
        actions={
          <Button type="button" variant="ghost" className="text-xs" onClick={() => setTransferOpen((v) => !v)}>
            Transfer table
          </Button>
        }
      />

      {notice ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{notice}</p>
      ) : null}

      {transferOpen ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-400">Move {tableId} order to:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tables
              .filter((t) => t.id !== tableId)
              .map((t) => (
                <Button key={t.id} type="button" variant="ghost" className="text-xs" onClick={() => transferTo(t.id)}>
                  {t.id}
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned waiter</label>
        {waitersQuery.isLoading ? (
          <p className="mt-2 text-xs text-slate-500">Loading waiters…</p>
        ) : waiters.length === 0 ? (
          <p className="mt-2 text-xs text-amber-200/80">
            No waiters found. Add users with the Waiter role under Users &amp; access, then restart the API.
          </p>
        ) : (
          <select
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
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
        {selectedWaiter ? <p className="mt-1 text-xs text-slate-500">Serving: {selectedWaiter.name}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">My tables</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTableId(t.id);
                setShowMenu(false);
                setNotice(null);
              }}
              className={`rounded-full px-3 py-1.5 text-sm ${
                tableId === t.id ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"
              }`}
            >
              {t.id}
              {t.status !== "free" ? (
                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
              ) : null}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span>Status:</span>
          <Badge tone={tableStatusTone(tables.find((t) => t.id === tableId)?.status ?? "free")}>
            {tables.find((t) => t.id === tableId)?.status ?? "free"}
          </Badge>
          <span className="font-mono text-slate-400">{orderRef}</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white">Order — {tableId}</div>
          {cart.length > 0 ? (
            <span className="text-xs text-amber-200/90">Rs {subtotal.toLocaleString()}</span>
          ) : null}
        </div>

        {cart.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {cart.map((line) => (
              <li key={line.item.id} className="flex items-center justify-between rounded bg-slate-950/50 px-2 py-1.5 text-sm">
                <span className="text-slate-200">
                  {formatMenuItemLabel(line.item)} ×{line.qty}
                </span>
                <span className="flex items-center gap-2">
                  <button type="button" className="text-slate-400 hover:text-white" onClick={() => setLineQty(line.item.id, line.qty - 1)}>
                    −
                  </button>
                  <button type="button" className="text-slate-400 hover:text-white" onClick={() => setLineQty(line.item.id, line.qty + 1)}>
                    +
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No items yet — tap Add items.</p>
        )}

        <textarea
          className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
          rows={3}
          placeholder="Customer notes, modifiers…"
          value={notes}
          onChange={(e) => updateDraft({ notes: e.target.value })}
        />

        <div className="mt-3 flex flex-wrap gap-2">
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
          <div className="mt-3 border-t border-slate-800 pt-3">
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {menuQuery.isLoading ? <p className="mt-2 text-xs text-slate-500">Loading menu…</p> : null}
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="flex w-full items-center justify-between rounded-md bg-slate-950/50 px-2 py-2 text-left text-sm hover:bg-slate-800"
                >
                  <span className="text-slate-200">{formatMenuItemLabel(item)}</span>
                  <span className="text-xs text-amber-200/90">Rs {item.price.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order status</div>
        {kitchenQuery.isLoading ? <p className="mt-2 text-xs text-slate-500">Loading…</p> : null}
        {tableKots.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No active KOT for this table.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {tableKots.map((k) => (
              <li key={k.id} className="rounded-md bg-slate-950/50 px-2 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-200">{k.ticketRef}</span>
                  <Badge
                    tone={
                      k.status === "ready"
                        ? "success"
                        : k.status === "cooking"
                          ? "info"
                          : "warning"
                    }
                  >
                    {k.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{k.itemsSummary}</p>
                <p className="mt-0.5 text-xs text-slate-500">{k.mins} min</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <Button
            type="button"
            className="w-full text-xs"
            disabled={cart.length === 0 || !waiterId || createBillMutation.isPending}
            onClick={() => void createAndPrintBill()}
          >
            {createBillMutation.isPending ? "Creating bill…" : "Create bill"}
            {cart.length > 0 ? ` · Rs ${total.toLocaleString()}` : ""}
          </Button>
          <p className="text-center text-[10px] text-slate-500">
            Saves bill with waiter name and opens print dialog
          </p>
        </div>
      </div>
    </div>
  );
}
