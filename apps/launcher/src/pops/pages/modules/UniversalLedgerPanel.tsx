import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCompletedOrders } from "../../api/billing";
import { fetchCustomerInvoices, fetchExpenses, fetchVendorBills } from "../../api/accounting";
import { fetchBranchInventory } from "../../api/inventory";
import { fetchBranchMenu } from "../../api/menu";
import { formatPkr } from "../../hooks/useInventory";
import { parseDeliveryFieldsFromNotes } from "../../lib/posLoadOrder";
import { fieldInputClass } from "../../lib/themeClasses";
import { karachiDateKey } from "../../lib/orderSales";
import { SimpleTable } from "../../ui/SimpleTable";

export type LedgerMode = "sale" | "purchase" | "expense" | "item" | "customer" | "supplier";

type ActivityRow = {
  id: string;
  date: string;
  type: string;
  detail: string;
  qty?: number;
  debit?: number;
  credit?: number;
  amount?: number;
};

type ListRow = {
  id: string;
  label: string;
  meta: string;
  amount?: number;
  balance?: number;
  kind: "menu" | "ingredient" | "customer" | "supplier";
};

const MODE_CARDS: { id: LedgerMode; title: string; hint: string }[] = [
  { id: "sale", title: "Sale", hint: "Completed bills / sales activity" },
  { id: "purchase", title: "Purchase", hint: "Vendor bills & GRN purchases" },
  { id: "expense", title: "Expense", hint: "Branch expenses" },
  { id: "item", title: "Item", hint: "Menu items + ingredients activity" },
  { id: "customer", title: "Customer", hint: "Receivable ledger by customer" },
  { id: "supplier", title: "Supplier", hint: "Purchase & payment history" },
];

function inDateRange(isoOrDate: string, from: string, to: string): boolean {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate.slice(0, 10))
    ? isoOrDate.slice(0, 10)
    : karachiDateKey(isoOrDate);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function dayLabel(isoOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(isoOrDate)) return isoOrDate.slice(0, 10);
  try {
    return karachiDateKey(isoOrDate);
  } catch {
    return isoOrDate.slice(0, 10);
  }
}

export function UniversalLedgerPanel({
  branchCode,
  from,
  to,
}: {
  branchCode: string;
  from: string;
  to: string;
}): JSX.Element {
  const [mode, setMode] = useState<LedgerMode | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ListRow | null>(null);

  const billsQuery = useQuery({
    queryKey: ["universal-ledger", "bills", branchCode],
    queryFn: () => fetchCompletedOrders(branchCode),
    enabled: Boolean(branchCode) && (mode === "sale" || mode === "item" || mode === "customer"),
  });
  const invoicesQuery = useQuery({
    queryKey: ["universal-ledger", "invoices", branchCode],
    queryFn: () => fetchCustomerInvoices(branchCode),
    enabled: Boolean(branchCode) && (mode === "customer" || mode === "sale"),
  });
  const vendorQuery = useQuery({
    queryKey: ["universal-ledger", "vendors", branchCode],
    queryFn: () => fetchVendorBills(branchCode),
    enabled: Boolean(branchCode) && (mode === "supplier" || mode === "purchase"),
  });
  const expensesQuery = useQuery({
    queryKey: ["universal-ledger", "expenses", branchCode],
    queryFn: () => fetchExpenses(branchCode),
    enabled: Boolean(branchCode) && mode === "expense",
  });
  const menuQuery = useQuery({
    queryKey: ["universal-ledger", "menu", branchCode],
    queryFn: () => fetchBranchMenu(branchCode),
    enabled: Boolean(branchCode) && mode === "item",
  });
  const inventoryQuery = useQuery({
    queryKey: ["universal-ledger", "inventory", branchCode],
    queryFn: () => fetchBranchInventory(branchCode),
    enabled: Boolean(branchCode) && (mode === "item" || mode === "purchase" || mode === "supplier"),
  });

  const listRows = useMemo((): ListRow[] => {
    if (!mode) return [];
    const q = search.trim().toLowerCase();

    if (mode === "item") {
      const catName = new Map((menuQuery.data?.categories ?? []).map((c) => [c.id, c.name]));
      const menuRows: ListRow[] = (menuQuery.data?.items ?? []).map((item) => ({
        id: `menu:${item.id}`,
        label: item.secondaryName?.trim() || item.name,
        meta: `Menu · ${catName.get(item.categoryId) ?? "Item"}`,
        kind: "menu" as const,
      }));
      const ingRows: ListRow[] = (inventoryQuery.data?.ingredients ?? []).map((ing) => ({
        id: `ing:${ing.id}`,
        label: ing.name,
        meta: `Ingredient · ${ing.sku} · stock ${ing.currentStock} ${ing.unit}`,
        amount: ing.currentStock * ing.unitCost,
        kind: "ingredient" as const,
      }));
      return [...menuRows, ...ingRows].filter(
        (r) => !q || r.label.toLowerCase().includes(q) || r.meta.toLowerCase().includes(q),
      );
    }

    if (mode === "customer") {
      const map = new Map<string, ListRow>();
      for (const inv of invoicesQuery.data ?? []) {
        const name = inv.customerName.trim() || "Customer";
        const phone = (inv.customerPhone ?? "").trim();
        const key = `${name}|${phone}`;
        const cur = map.get(key) ?? {
          id: key,
          label: name,
          meta: phone || "No phone",
          balance: 0,
          amount: 0,
          kind: "customer" as const,
        };
        cur.balance = (cur.balance ?? 0) + inv.balance;
        cur.amount = (cur.amount ?? 0) + inv.amount;
        map.set(key, cur);
      }
      for (const bill of billsQuery.data ?? []) {
        if (bill.status !== "completed") continue;
        const parsed = parseDeliveryFieldsFromNotes(bill.notes);
        const name = parsed.customer.trim();
        if (!name) continue;
        const phone = parsed.phone.trim();
        const key = `${name}|${phone}`;
        const cur = map.get(key) ?? {
          id: key,
          label: name,
          meta: phone || "No phone",
          balance: 0,
          amount: 0,
          kind: "customer" as const,
        };
        cur.amount = (cur.amount ?? 0) + bill.total;
        map.set(key, cur);
      }
      return [...map.values()]
        .filter((r) => !q || r.label.toLowerCase().includes(q) || r.meta.toLowerCase().includes(q))
        .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0) || (b.amount ?? 0) - (a.amount ?? 0));
    }

    if (mode === "supplier") {
      const fromVendors = new Map<string, ListRow>();
      for (const bill of vendorQuery.data ?? []) {
        const id = bill.supplierId || bill.supplierName;
        const cur = fromVendors.get(id) ?? {
          id,
          label: bill.supplierName,
          meta: "Supplier",
          balance: 0,
          amount: 0,
          kind: "supplier" as const,
        };
        cur.balance = (cur.balance ?? 0) + bill.balance;
        cur.amount = (cur.amount ?? 0) + bill.amount;
        fromVendors.set(id, cur);
      }
      for (const s of inventoryQuery.data?.suppliers ?? []) {
        if (!fromVendors.has(s.id)) {
          fromVendors.set(s.id, {
            id: s.id,
            label: s.name,
            meta: s.phone ? `Supplier · ${s.phone}` : "Supplier",
            balance: 0,
            kind: "supplier",
          });
        }
      }
      return [...fromVendors.values()]
        .filter((r) => !q || r.label.toLowerCase().includes(q) || r.meta.toLowerCase().includes(q))
        .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
    }

    return [];
  }, [
    mode,
    search,
    menuQuery.data,
    inventoryQuery.data,
    invoicesQuery.data,
    billsQuery.data,
    vendorQuery.data,
  ]);

  const activityRows = useMemo((): ActivityRow[] => {
    if (!mode) return [];

    if (mode === "sale" && !selected) {
      return (billsQuery.data ?? [])
        .filter((b) => b.status === "completed" && inDateRange(b.createdAt, from, to))
        .map((b) => ({
          id: b.id,
          date: dayLabel(b.createdAt),
          type: "Sale",
          detail: `${b.billRef} · ${b.tableLabel} · ${b.waiterName}`,
          amount: b.total,
          credit: b.total,
        }));
    }

    if (mode === "purchase" && !selected) {
      const vendorRows: ActivityRow[] = (vendorQuery.data ?? [])
        .filter((b) => inDateRange(b.createdAt, from, to))
        .map((b) => ({
          id: `vb-${b.id}`,
          date: dayLabel(b.createdAt),
          type: "Vendor bill",
          detail: `${b.billRef} · ${b.supplierName}${b.invoiceNumber ? ` · inv ${b.invoiceNumber}` : ""}`,
          amount: b.amount,
          debit: b.amount,
          credit: b.paid,
        }));
      const grnRows: ActivityRow[] = (inventoryQuery.data?.goodsReceipts ?? [])
        .filter((g) => inDateRange(g.deliveryDate || g.createdAt, from, to))
        .map((g) => ({
          id: `grn-${g.id}`,
          date: dayLabel(g.deliveryDate || g.createdAt),
          type: "GRN",
          detail: `${g.grnNumber} · ${g.supplierName}`,
          amount: g.totalCost,
          debit: g.totalCost,
        }));
      return [...vendorRows, ...grnRows].sort((a, b) => b.date.localeCompare(a.date));
    }

    if (mode === "expense") {
      return (expensesQuery.data ?? [])
        .filter((e) => inDateRange(e.expenseDate, from, to))
        .map((e) => ({
          id: e.id,
          date: dayLabel(e.expenseDate),
          type: e.category,
          detail: [e.vendor, e.description].filter(Boolean).join(" · ") || "Expense",
          amount: e.amount,
          debit: e.amount,
        }));
    }

    if (mode === "customer" && selected) {
      const [name, phone] = selected.id.split("|");
      const invoiceRows = (invoicesQuery.data ?? [])
        .filter(
          (inv) =>
            (inv.customerName.trim() || "Customer") === name &&
            (inv.customerPhone ?? "").trim() === (phone ?? "") &&
            inDateRange(inv.createdAt, from, to),
        )
        .flatMap((inv) => {
          const rows: ActivityRow[] = [
            {
              id: `inv-${inv.id}`,
              date: dayLabel(inv.createdAt),
              type: "Invoice",
              detail: `${inv.invoiceRef}${inv.description ? ` · ${inv.description}` : ""}`,
              debit: inv.amount,
              amount: inv.amount,
            },
          ];
          if (inv.paid > 0) {
            rows.push({
              id: `pay-${inv.id}`,
              date: dayLabel(inv.createdAt),
              type: "Payment",
              detail: `Paid on ${inv.invoiceRef}`,
              credit: inv.paid,
              amount: inv.paid,
            });
          }
          return rows;
        });
      const saleRows: ActivityRow[] = (billsQuery.data ?? [])
        .filter((b) => {
          if (b.status !== "completed" || !inDateRange(b.createdAt, from, to)) return false;
          const parsed = parseDeliveryFieldsFromNotes(b.notes);
          return parsed.customer.trim() === name && parsed.phone.trim() === (phone ?? "");
        })
        .map((b) => ({
          id: `sale-${b.id}`,
          date: dayLabel(b.createdAt),
          type: "Sale",
          detail: `${b.billRef} · ${b.tableLabel}`,
          credit: b.total,
          amount: b.total,
        }));
      return [...invoiceRows, ...saleRows].sort((a, b) => b.date.localeCompare(a.date));
    }

    if (mode === "supplier" && selected) {
      const vendorRows: ActivityRow[] = (vendorQuery.data ?? [])
        .filter(
          (b) =>
            (b.supplierId === selected.id || b.supplierName === selected.label) &&
            inDateRange(b.createdAt, from, to),
        )
        .flatMap((b) => {
          const rows: ActivityRow[] = [
            {
              id: `vb-${b.id}`,
              date: dayLabel(b.createdAt),
              type: "Purchase bill",
              detail: `${b.billRef}${b.invoiceNumber ? ` · ${b.invoiceNumber}` : ""}`,
              debit: b.amount,
              amount: b.amount,
            },
          ];
          if (b.paid > 0) {
            rows.push({
              id: `vpay-${b.id}`,
              date: dayLabel(b.createdAt),
              type: "Payment",
              detail: `Payment on ${b.billRef}`,
              credit: b.paid,
              amount: b.paid,
            });
          }
          return rows;
        });
      const grnRows: ActivityRow[] = (inventoryQuery.data?.goodsReceipts ?? [])
        .filter(
          (g) =>
            (g.supplierId === selected.id || g.supplierName === selected.label) &&
            inDateRange(g.deliveryDate || g.createdAt, from, to),
        )
        .map((g) => ({
          id: `grn-${g.id}`,
          date: dayLabel(g.deliveryDate || g.createdAt),
          type: "GRN / Stock in",
          detail: `${g.grnNumber} · ${g.items.length} line(s)`,
          debit: g.totalCost,
          amount: g.totalCost,
          qty: g.items.reduce((s, l) => s + l.qty, 0),
        }));
      return [...vendorRows, ...grnRows].sort((a, b) => b.date.localeCompare(a.date));
    }

    if (mode === "item" && selected?.kind === "menu") {
      const menuId = selected.id.replace(/^menu:/, "");
      const labelKey = selected.label.trim().toLowerCase();
      const rows: ActivityRow[] = [];
      for (const bill of billsQuery.data ?? []) {
        if (bill.status !== "completed" || !inDateRange(bill.createdAt, from, to)) continue;
        for (const line of bill.lines ?? []) {
          const byId = line.menuItemId && line.menuItemId === menuId;
          const byName = !line.menuItemId && line.label.trim().toLowerCase() === labelKey;
          if (!byId && !byName) continue;
          const qty = Number(line.qty ?? 0);
          const amount = qty * Number(line.unitPrice ?? 0);
          rows.push({
            id: `${bill.id}-${line.label}-${qty}`,
            date: dayLabel(bill.createdAt),
            type: "Sale",
            detail: `${bill.billRef} · ${line.label}`,
            qty,
            credit: amount,
            amount,
          });
        }
      }
      return rows.sort((a, b) => b.date.localeCompare(a.date));
    }

    if (mode === "item" && selected?.kind === "ingredient") {
      const ingId = selected.id.replace(/^ing:/, "");
      const adj: ActivityRow[] = (inventoryQuery.data?.adjustments ?? [])
        .filter((a) => a.ingredientId === ingId && inDateRange(a.date, from, to))
        .map((a) => ({
          id: `adj-${a.id}`,
          date: dayLabel(a.date),
          type: `Stock ${a.type}`,
          detail: `${a.reason} · ${a.status}`,
          qty: a.type === "Remove" ? -Math.abs(a.qty) : a.qty,
        }));
      const waste: ActivityRow[] = (inventoryQuery.data?.wasteRecords ?? [])
        .filter((w) => w.ingredientId === ingId && inDateRange(w.date, from, to))
        .map((w) => ({
          id: `waste-${w.id}`,
          date: dayLabel(w.date),
          type: "Waste / Stock out",
          detail: w.reason || "Waste",
          qty: -Math.abs(w.qty),
        }));
      const grn: ActivityRow[] = [];
      for (const g of inventoryQuery.data?.goodsReceipts ?? []) {
        if (!inDateRange(g.deliveryDate || g.createdAt, from, to)) continue;
        for (const line of g.items) {
          if (line.ingredientId !== ingId) continue;
          grn.push({
            id: `grn-${g.id}-${line.ingredientId}-${line.qty}`,
            date: dayLabel(g.deliveryDate || g.createdAt),
            type: "Purchase / Stock in",
            detail: `${g.grnNumber} · ${g.supplierName}`,
            qty: line.qty,
            amount: line.qty * line.unitCost,
          });
        }
      }
      return [...adj, ...waste, ...grn].sort((a, b) => b.date.localeCompare(a.date));
    }

    return [];
  }, [
    mode,
    selected,
    from,
    to,
    billsQuery.data,
    vendorQuery.data,
    expensesQuery.data,
    invoicesQuery.data,
    inventoryQuery.data,
  ]);

  const loading =
    (mode === "sale" && billsQuery.isLoading) ||
    (mode === "purchase" && (vendorQuery.isLoading || inventoryQuery.isLoading)) ||
    (mode === "expense" && expensesQuery.isLoading) ||
    (mode === "item" && (menuQuery.isLoading || inventoryQuery.isLoading || (selected && billsQuery.isLoading))) ||
    (mode === "customer" && (invoicesQuery.isLoading || billsQuery.isLoading)) ||
    (mode === "supplier" && (vendorQuery.isLoading || inventoryQuery.isLoading));

  function pickMode(next: LedgerMode): void {
    setMode(next);
    setSelected(null);
    setSearch("");
  }

  function goBack(): void {
    if (selected) {
      setSelected(null);
      return;
    }
    setMode(null);
    setSearch("");
  }

  if (!mode) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Pehle choose karein ke aap kya dekhna chahte hain — phir date range upar se lagayein.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODE_CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => pickMode(card.id)}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-amber-400/60 hover:bg-amber-50/40 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/5"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{card.title}</div>
              <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const needsPicker = mode === "item" || mode === "customer" || mode === "supplier";
  const showList = needsPicker && !selected;
  const showActivity = !needsPicker || Boolean(selected);
  const modeTitle = MODE_CARDS.find((m) => m.id === mode)?.title ?? mode;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          ← Back
        </button>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {modeTitle}
          {selected ? ` · ${selected.label}` : ""}
        </span>
        <span className="text-[11px] text-slate-500">
          {from} → {to}
        </span>
      </div>

      {showList ? (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              mode === "item"
                ? "Search menu items or ingredients…"
                : mode === "customer"
                  ? "Search customer…"
                  : "Search supplier…"
            }
            className={`${fieldInputClass} max-w-md`}
          />
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : listRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
              No {modeTitle.toLowerCase()} records found.
            </p>
          ) : (
            <SimpleTable
              rowKey={(r) => r.id}
              onRowClick={(r) => setSelected(r)}
              columns={[
                { key: "label", header: mode === "item" ? "Item" : modeTitle },
                { key: "meta", header: "Info" },
                {
                  key: "balance",
                  header: mode === "item" ? "Stock value" : "Balance",
                  render: (r) =>
                    r.balance != null
                      ? formatPkr(r.balance)
                      : r.amount != null
                        ? formatPkr(r.amount)
                        : "—",
                },
              ]}
              rows={listRows}
            />
          )}
          <p className="text-[11px] text-slate-500">Row pe click karein — full activity date range ke hisaab se open hogi.</p>
        </>
      ) : null}

      {showActivity ? (
        loading ? (
          <p className="text-sm text-slate-500">Loading activity…</p>
        ) : activityRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
            Is date range mein koi activity nahi mili.
          </p>
        ) : (
          <SimpleTable
            rowKey={(r) => r.id}
            columns={[
              { key: "date", header: "Date" },
              { key: "type", header: "Type" },
              { key: "detail", header: "Detail" },
              {
                key: "qty",
                header: "Qty",
                render: (r) => (r.qty != null ? Number(r.qty).toLocaleString() : "—"),
              },
              {
                key: "debit",
                header: "Debit",
                render: (r) => (r.debit != null ? formatPkr(Number(r.debit)) : "—"),
              },
              {
                key: "credit",
                header: "Credit",
                render: (r) => (r.credit != null ? formatPkr(Number(r.credit)) : "—"),
              },
              {
                key: "amount",
                header: "Amount",
                render: (r) => (r.amount != null ? formatPkr(Number(r.amount)) : "—"),
              },
            ]}
            rows={activityRows}
          />
        )
      ) : null}
    </div>
  );
}
