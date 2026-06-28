import type { StoreSale, StoreSaleReturn } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "../../pops/ui/Badge";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createStoreCoupon,
  createStoreGiftCard,
  createStorePurchaseReturn,
  createStoreSaleReturn,
  fetchStoreCoupons,
  fetchStoreEmployeeReport,
  fetchStoreGiftCards,
  fetchStorePeakHoursReport,
  fetchStoreProducts,
  fetchStorePurchaseReturns,
  fetchStoreSaleReturns,
  fetchStoreSales,
  fetchStoreSuppliers,
  fetchStoreWastageReport,
} from "../api/store";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreInput, StoreSelect } from "../ui/StoreUi";

export function StoreCouponsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("10");
  const [type, setType] = useState<"percent" | "fixed">("percent");

  const query = useQuery({ queryKey: ["store", "coupons", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreCoupons(branch!.code) });
  const createMutation = useMutation({
    mutationFn: () => createStoreCoupon({ branchCode: branch!.code, code, name, type, value: Number(value) }),
    onSuccess: () => { invalidate(); setCode(""); setName(""); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Coupons" subtitle="Eid, Ramadan, and seasonal discount coupons — validated automatically at checkout." />
      {canManage ? (
        <form className="grid gap-2 rounded-xl border p-4 sm:grid-cols-5 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
          <StoreInput placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <StoreInput placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <StoreSelect value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="percent">% off</option><option value="fixed">Fixed Rs</option></StoreSelect>
          <StoreInput type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          <button type="submit" className="rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white">Create</button>
        </form>
      ) : null}
      <SimpleTable rowKey={(r) => r.id} columns={[
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        { key: "value", header: "Value" },
        { key: "usage", header: "Used", render: (r) => `${r.usageCount}${r.maxUses ? ` / ${r.maxUses}` : ""}` },
        { key: "active", header: "Status", render: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Off"}</Badge> },
      ]} rows={query.data ?? []} />
    </div>
  );
}

export function StoreGiftCardsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [cardNumber, setCardNumber] = useState("");
  const [balance, setBalance] = useState("1000");
  const [issuedTo, setIssuedTo] = useState("");

  const query = useQuery({ queryKey: ["store", "gift-cards", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreGiftCards(branch!.code) });
  const createMutation = useMutation({
    mutationFn: () => createStoreGiftCard({ branchCode: branch!.code, cardNumber, initialBalancePkr: Number(balance), issuedTo: issuedTo || undefined }),
    onSuccess: () => { invalidate(); setCardNumber(""); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Gift cards" subtitle="Issue Rs 500 / Rs 1000 gift cards — redeemable at POS checkout." />
      {canManage ? (
        <form className="grid gap-2 rounded-xl border p-4 sm:grid-cols-4 dark:border-slate-800" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
          <StoreInput placeholder="Card number" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} required />
          <StoreInput type="number" placeholder="Balance" value={balance} onChange={(e) => setBalance(e.target.value)} />
          <StoreInput placeholder="Issued to" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} />
          <button type="submit" className="rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white">Issue card</button>
        </form>
      ) : null}
      <SimpleTable rowKey={(r) => r.id} columns={[
        { key: "card", header: "Card #", render: (r) => r.cardNumber },
        { key: "balance", header: "Balance", render: (r) => formatPkr(r.balancePkr) },
        { key: "initial", header: "Initial", render: (r) => formatPkr(r.initialBalancePkr) },
        { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge> },
        { key: "to", header: "Issued to", render: (r) => r.issuedTo ?? "—" },
      ]} rows={query.data ?? []} />
    </div>
  );
}

export function StoreReturnsPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"Cash" | "Card">("Cash");
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});

  const salesQuery = useQuery({ queryKey: ["store", "sales", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreSales(branch!.code) });
  const returnsQuery = useQuery({ queryKey: ["store", "sale-returns", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreSaleReturns(branch!.code) });

  const selectedSale = useMemo(() => (salesQuery.data ?? []).find((s) => s.id === saleId), [salesQuery.data, saleId]);

  const returnMutation = useMutation({
    mutationFn: () => {
      const lines = Object.entries(returnQty).filter(([, q]) => q > 0).map(([productId, qty]) => ({ productId, qty }));
      return createStoreSaleReturn({ branchCode: branch!.code, saleId, reason, refundMethod, lines });
    },
    onSuccess: () => { invalidate(); setSaleId(""); setReturnQty({}); setNotice("Return processed — stock restored"); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Sales returns & refunds" subtitle="Process returns, restore inventory, and issue refunds." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      <div className="rounded-xl border p-4 dark:border-slate-800">
        <StoreField label="Original sale">
          <StoreSelect value={saleId} onChange={(e) => setSaleId(e.target.value)}>
            <option value="">Select completed sale</option>
            {(salesQuery.data ?? []).filter((s: StoreSale) => s.status === "Completed").map((s) => (
              <option key={s.id} value={s.id}>{s.invoiceNumber} · {formatPkr(s.total)} · {new Date(s.createdAt).toLocaleDateString()}</option>
            ))}
          </StoreSelect>
        </StoreField>
        {selectedSale ? (
          <div className="mt-3 space-y-2">
            {selectedSale.lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between text-sm">
                <span>{line.productName} (max {line.qty})</span>
                <input type="number" min={0} max={line.qty} className="w-20 rounded border px-2 py-1" value={returnQty[line.productId] ?? ""} onChange={(e) => setReturnQty((p) => ({ ...p, [line.productId]: Number(e.target.value) || 0 }))} />
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StoreInput placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <StoreSelect value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as typeof refundMethod)}><option value="Cash">Cash</option><option value="Card">Card</option></StoreSelect>
          <button type="button" disabled={!saleId || !reason || returnMutation.isPending} onClick={() => returnMutation.mutate()} className="rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white disabled:opacity-50">Process return</button>
        </div>
      </div>

      <SimpleTable<StoreSaleReturn> rowKey={(r) => r.id} columns={[
        { key: "num", header: "Return #", render: (r) => r.returnNumber },
        { key: "inv", header: "Invoice", render: (r) => r.invoiceNumber },
        { key: "refund", header: "Refund", render: (r) => formatPkr(r.totalRefund) },
        { key: "method", header: "Method", render: (r) => r.refundMethod },
        { key: "date", header: "Date", render: (r) => new Date(r.createdAt).toLocaleString() },
      ]} rows={returnsQuery.data ?? []} />
    </div>
  );
}

export function StorePurchaseReturnsPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [items, setItems] = useState<{ productId: string; qty: number; unitPrice: number }[]>([]);

  const suppliersQuery = useQuery({ queryKey: ["store", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreSuppliers(branch!.code) });
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });
  const returnsQuery = useQuery({ queryKey: ["store", "purchase-returns", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStorePurchaseReturns(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStorePurchaseReturn({ branchCode: branch!.code, supplierId, reason, items }),
    onSuccess: () => { invalidate(); setItems([]); setReason(""); },
  });

  if (!canManage) return <p className="text-sm text-slate-500">Purchase returns require inventory manager access.</p>;

  return (
    <div className="space-y-5">
      <PageHeader title="Purchase returns" subtitle="Return damaged goods to suppliers — debit note / PRN." />
      <div className="rounded-xl border p-4 dark:border-slate-800">
        <div className="grid gap-2 sm:grid-cols-4">
          <StoreSelect value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required><option value="">Supplier</option>{(suppliersQuery.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</StoreSelect>
          <StoreSelect value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Product</option>{(productsQuery.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</StoreSelect>
          <StoreInput type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
          <button type="button" onClick={() => { if (productId) setItems((p) => [...p, { productId, qty, unitPrice }]); }} className="rounded-lg border py-2 text-sm">Add line</button>
        </div>
        <StoreInput className="mt-2" placeholder="Reason (damaged, expired…)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="button" disabled={!supplierId || !reason || items.length === 0} onClick={() => createMutation.mutate()} className="mt-3 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Submit return</button>
      </div>
      <SimpleTable rowKey={(r) => r.id} columns={[
        { key: "num", header: "PRN", render: (r) => r.returnNumber },
        { key: "sup", header: "Supplier", render: (r) => r.supplierName ?? "—" },
        { key: "amt", header: "Amount", render: (r) => formatPkr(r.totalAmount) },
        { key: "reason", header: "Reason", render: (r) => r.reason },
      ]} rows={returnsQuery.data ?? []} />
    </div>
  );
}

export function StorePeakHoursPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const reportQuery = useQuery({ queryKey: ["store", "peak-hours", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStorePeakHoursReport(branch!.code) });
  const report = reportQuery.data;
  const maxAmount = Math.max(...(report?.hourlySales.map((h) => h.amount) ?? [1]), 1);

  return (
    <div className="space-y-5">
      <PageHeader title="Peak hours analysis" subtitle="Identify busy and slow periods for staff scheduling." />
      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4 dark:border-slate-800"><h3 className="text-sm font-semibold text-emerald-600">Peak hours</h3><ul className="mt-2 text-sm">{report.peakHours.map((h) => <li key={h.hour}>{h.label} — {formatPkr(h.amount)}</li>)}</ul></div>
            <div className="rounded-xl border p-4 dark:border-slate-800"><h3 className="text-sm font-semibold text-amber-600">Slow hours</h3><ul className="mt-2 text-sm">{report.slowHours.map((h) => <li key={h.hour}>{h.label} — {formatPkr(h.amount)}</li>)}</ul></div>
          </div>
          <div className="rounded-xl border p-4 dark:border-slate-800">
            <h3 className="mb-3 text-sm font-semibold">Hourly sales</h3>
            <div className="flex h-40 items-end gap-1">
              {report.hourlySales.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1" title={`${h.label}: ${formatPkr(h.amount)}`}>
                  <div className="w-full rounded-t bg-sky-500/80" style={{ height: `${Math.max(4, (h.amount / maxAmount) * 100)}%` }} />
                  <span className="text-[9px] text-slate-500">{h.hour}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : <p className="text-sm text-slate-500">Loading…</p>}
    </div>
  );
}

export function StoreEmployeeReportPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const reportQuery = useQuery({ queryKey: ["store", "employees", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreEmployeeReport(branch!.code) });
  return (
    <div className="space-y-5">
      <PageHeader title="Employee / cashier report" subtitle="Sales performance by cashier across shifts." />
      <SimpleTable rowKey={(r) => r.cashierName} columns={[
        { key: "name", header: "Cashier", render: (r) => r.cashierName },
        { key: "shifts", header: "Shifts", render: (r) => r.shiftCount },
        { key: "sales", header: "Sales", render: (r) => formatPkr(r.totalSalesPkr) },
        { key: "txns", header: "Transactions", render: (r) => r.transactionCount },
        { key: "avg", header: "Avg ticket", render: (r) => formatPkr(r.avgTicketPkr) },
      ]} rows={reportQuery.data?.cashiers ?? []} />
    </div>
  );
}

export function StoreWastageReportPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const reportQuery = useQuery({ queryKey: ["store", "wastage", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreWastageReport(branch!.code) });
  const report = reportQuery.data;
  return (
    <div className="space-y-5">
      <PageHeader title="Wastage & damage" subtitle="Expired, damaged, lost, and theft write-offs from stock adjustments." />
      {report ? <p className="text-sm">Total loss value: <strong>{formatPkr(report.totalValuePkr)}</strong></p> : null}
      <SimpleTable rowKey={(r) => `${r.sku}-${r.createdAt}`} columns={[
        { key: "reason", header: "Reason", render: (r) => r.reason },
        { key: "product", header: "Product", render: (r) => r.productName },
        { key: "qty", header: "Qty", render: (r) => r.qty },
        { key: "value", header: "Value", render: (r) => formatPkr(r.valuePkr) },
        { key: "date", header: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
      ]} rows={report?.items ?? []} />
    </div>
  );
}
