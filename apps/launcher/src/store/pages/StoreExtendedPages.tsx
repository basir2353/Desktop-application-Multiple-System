import type { StorePromotion, StoreShift } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "../../pops/ui/Badge";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import {
  closeStoreShift,
  createStorePromotion,
  fetchStoreCashMovements,
  fetchStoreOpenShift,
  fetchStorePosShortcuts,
  fetchStoreProducts,
  fetchStorePromotions,
  fetchStoreShifts,
  openStoreShift,
  recordStoreCashMovement,
  toggleStorePromotion,
  upsertStorePosShortcut,
} from "../api/store";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { getTerminalId } from "../lib/storePosSync";
import { touchButtonEmoji } from "../lib/storePromotions";
import { StoreField, StoreInput, StoreSelect } from "../ui/StoreUi";

export function StoreShiftPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const terminalId = getTerminalId();
  const [cashierName, setCashierName] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [paidType, setPaidType] = useState<"paid_in" | "paid_out">("paid_out");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidReason, setPaidReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openShiftQuery = useQuery({
    queryKey: ["store", "shift-open", branch?.code, terminalId],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreOpenShift(branch!.code, terminalId),
  });

  const shiftsQuery = useQuery({
    queryKey: ["store", "shifts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreShifts(branch!.code),
  });

  const openMutation = useMutation({
    mutationFn: () =>
      openStoreShift({
        branchCode: branch!.code,
        cashierName: cashierName.trim(),
        openingCashPkr: Number(openingCash) || 0,
        terminalId,
      }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeStoreShift(openShiftQuery.data!.id, { closingCashPkr: Number(closingCash) }),
    onSuccess: () => { invalidate(); setClosingCash(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const openShift = openShiftQuery.data;

  const cashMovementsQuery = useQuery({
    queryKey: ["store", "cash-movements", openShift?.id],
    enabled: Boolean(openShift?.id),
    queryFn: () => fetchStoreCashMovements(openShift!.id),
  });

  const paidMutation = useMutation({
    mutationFn: () =>
      recordStoreCashMovement({
        branchCode: branch!.code,
        shiftId: openShift!.id,
        type: paidType,
        amountPkr: Number(paidAmount),
        reason: paidReason.trim(),
      }),
    onSuccess: () => { invalidate(); setPaidAmount(""); setPaidReason(""); cashMovementsQuery.refetch(); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Shift & cash reconciliation" subtitle={`Terminal ${terminalId} — compare expected vs actual cash at shift close.`} />
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {openShift ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 dark:bg-emerald-950/20">
          <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Active shift — {openShift.cashierName}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Stat label="Opening cash" value={formatPkr(openShift.openingCashPkr)} />
            <Stat label="Sales this shift" value={formatPkr(openShift.totalSalesPkr)} />
            <Stat label="Transactions" value={String(openShift.transactionCount)} />
            <Stat label="Opened" value={new Date(openShift.openedAt).toLocaleTimeString()} />
          </div>
          <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); closeMutation.mutate(); }}>
            <StoreField label="Closing cash counted">
              <StoreInput type="number" min={0} value={closingCash} onChange={(e) => setClosingCash(e.target.value)} required />
            </StoreField>
            <button type="submit" disabled={!closingCash || closeMutation.isPending} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
              Close shift & reconcile
            </button>
          </form>

          <div className="mt-5 border-t border-emerald-500/20 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Cash paid-in / paid-out</h3>
            <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); paidMutation.mutate(); }}>
              <StoreSelect value={paidType} onChange={(e) => setPaidType(e.target.value as typeof paidType)}>
                <option value="paid_in">Cash in (change deposit)</option>
                <option value="paid_out">Cash out (vendor/expense)</option>
              </StoreSelect>
              <StoreInput type="number" min={1} placeholder="Amount" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} required />
              <StoreInput placeholder="Reason" value={paidReason} onChange={(e) => setPaidReason(e.target.value)} required className="min-w-[180px]" />
              <button type="submit" disabled={!paidAmount || !paidReason.trim()} className="rounded-lg border border-emerald-600 px-3 py-2 text-xs font-semibold text-emerald-700">Record</button>
            </form>
            {(cashMovementsQuery.data ?? []).length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {(cashMovementsQuery.data ?? []).map((m) => (
                  <li key={m.id}>{m.type === "paid_in" ? "+" : "−"}{formatPkr(m.amountPkr)} — {m.reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : (
        <form className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); openMutation.mutate(); }}>
          <h2 className="text-sm font-semibold">Open new shift</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <StoreInput placeholder="Cashier name" value={cashierName} onChange={(e) => setCashierName(e.target.value)} required />
            <StoreInput type="number" min={0} placeholder="Opening cash" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
            <button type="submit" disabled={!cashierName.trim() || openMutation.isPending} className="rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Start shift</button>
          </div>
        </form>
      )}

      <SimpleTable<StoreShift>
        rowKey={(r) => r.id}
        columns={[
          { key: "cashierName", header: "Cashier" },
          { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "open" ? "success" : "neutral"}>{r.status}</Badge> },
          { key: "totalSalesPkr", header: "Sales", render: (r) => formatPkr(r.totalSalesPkr) },
          { key: "expectedCashPkr", header: "Expected cash", render: (r) => (r.expectedCashPkr != null ? formatPkr(r.expectedCashPkr) : "—") },
          { key: "cashDifferencePkr", header: "Variance", render: (r) => (r.cashDifferencePkr != null ? formatPkr(r.cashDifferencePkr) : "—") },
          { key: "openedAt", header: "Opened", render: (r) => new Date(r.openedAt).toLocaleString() },
        ]}
        rows={shiftsQuery.data ?? []}
      />
    </div>
  );
}

export function StorePromotionsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"percent_off" | "buy_x_get_y" | "fixed_bundle" | "mix_match" | "cross_sell" | "category_off">("percent_off");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const promotionsQuery = useQuery({
    queryKey: ["store", "promotions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStorePromotions(branch!.code),
  });

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createStorePromotion({
        branchCode: branch!.code,
        name: name.trim(),
        type,
        productIds: selectedProducts,
        config:
          type === "percent_off"
            ? { percent: 20 }
            : type === "buy_x_get_y"
              ? { buyQty: 2, getQty: 1 }
              : type === "fixed_bundle"
                ? { bundlePrice: 500 }
                : { anyQty: 3, fixedPrice: 1000 },
      }),
    onSuccess: () => { invalidate(); setName(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => toggleStorePromotion(id, isActive),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Promotions & bundles" subtitle="Buy 2 Get 1, combo deals, mix & match, and percentage discounts — applied automatically at POS." />
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {canManage ? (
        <form className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
          <h2 className="text-sm font-semibold">Create promotion</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <StoreInput placeholder="Promotion name" value={name} onChange={(e) => setName(e.target.value)} required />
            <StoreSelect value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="percent_off">% off</option>
              <option value="buy_x_get_y">Buy X Get Y</option>
              <option value="fixed_bundle">Combo bundle</option>
              <option value="mix_match">Mix & match</option>
              <option value="cross_sell">Cross-sell</option>
              <option value="category_off">Category %</option>
            </StoreSelect>
            <button type="submit" disabled={!name.trim() || createMutation.isPending} className="rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Add promotion</button>
          </div>
          <StoreSelect multiple value={selectedProducts} onChange={(e) => setSelectedProducts(Array.from(e.target.selectedOptions, (o) => o.value))} className="mt-2 h-24">
            {(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </StoreSelect>
          <p className="mt-1 text-xs text-slate-500">Hold Ctrl/Cmd to select products for targeted promos.</p>
        </form>
      ) : null}

      <SimpleTable<StorePromotion>
        rowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Name" },
          { key: "type", header: "Type" },
          { key: "isActive", header: "Active", render: (r) => (
            <button type="button" onClick={() => canManage && toggleMutation.mutate({ id: r.id, isActive: !r.isActive })} className="text-xs font-medium text-sky-600">
              {r.isActive ? "Active" : "Inactive"}
            </button>
          ) },
          { key: "config", header: "Rules", render: (r) => JSON.stringify(r.config) },
        ]}
        rows={promotionsQuery.data ?? []}
      />
    </div>
  );
}

export function StoreShortcutsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [hotkey, setHotkey] = useState("F1");
  const [label, setLabel] = useState("");
  const [productId, setProductId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const shortcutsQuery = useQuery({
    queryKey: ["store", "shortcuts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStorePosShortcuts(branch!.code),
  });

  const productsQuery = useQuery({
    queryKey: ["store", "products", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreProducts(branch!.code),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertStorePosShortcut({
        branchCode: branch!.code,
        hotkey,
        label: label.trim(),
        productId,
      }),
    onSuccess: () => { invalidate(); setLabel(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="POS quick buttons" subtitle="Map F1–F12 to fast-moving items like bread, milk, and eggs." />
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {canManage ? (
        <form className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}>
          <div className="grid gap-2 sm:grid-cols-4">
            <StoreSelect value={hotkey} onChange={(e) => setHotkey(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => `F${i + 1}`).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </StoreSelect>
            <StoreInput placeholder="Button label" value={label} onChange={(e) => setLabel(e.target.value)} required />
            <StoreSelect value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="">Select product</option>
              {(productsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </StoreSelect>
            <button type="submit" disabled={!label.trim() || !productId || saveMutation.isPending} className="rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save shortcut</button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {(shortcutsQuery.data ?? []).map((s) => {
          const product = (productsQuery.data ?? []).find((p) => p.id === s.productId);
          return (
          <div key={s.id} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
            <span className="text-2xl">{touchButtonEmoji(s.label, product)}</span>
            <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px] dark:bg-slate-800">{s.hotkey}</kbd>
            <p className="text-sm font-semibold">{s.label}</p>
            <p className="text-xs text-slate-500">{s.productName}</p>
          </div>
        );})}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
