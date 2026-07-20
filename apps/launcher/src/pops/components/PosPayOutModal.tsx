import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  fetchCustomerInvoices,
  fetchOpenCashSession,
  fetchVendorBills,
  recordCashMovement,
} from "../api/accounting";
import { fetchEmployees } from "../api/hr";
import { fetchBranchInventory } from "../api/inventory";
import { formatPkr } from "../hooks/useAccounting";
import { fieldInputClass, modalBackdropRaisedClass } from "../lib/themeClasses";
import { usePopsStore } from "../../stores/popsStore";

type Props = {
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

type PartyKind = "supplier" | "customer" | "employee";
type PartyFilter = "all" | PartyKind;

type PosPayOutAccount = {
  kind: PartyKind;
  id: string;
  name: string;
  detail: string | null;
  balance: number | null;
  status: string | null;
};

const PARTY_LABEL: Record<PartyKind, string> = {
  supplier: "Supplier",
  customer: "Customer",
  employee: "Employee",
};

const FILTERS: { id: PartyFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "supplier", label: "Supplier" },
  { id: "customer", label: "Customer" },
  { id: "employee", label: "Employee" },
];

function accountReasonPrefix(account: PosPayOutAccount): string {
  return `${PARTY_LABEL[account.kind]}: ${account.name}`;
}

export function PosPayOutModal({ onClose, onSuccess }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("all");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [selectedAccount, setSelectedAccount] = useState<PosPayOutAccount | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

  const partiesQuery = useQuery({
    queryKey: ["pos", "payout-parties", branch?.code],
    enabled: Boolean(branch?.code) && accountPickerOpen,
    queryFn: async () => {
      const code = branch!.code;
      const [invoices, vendorBills, inventory, employees] = await Promise.all([
        fetchCustomerInvoices(code).catch(() => []),
        fetchVendorBills(code).catch(() => []),
        fetchBranchInventory(code).catch(() => null),
        fetchEmployees(code).catch(() => []),
      ]);
      return { invoices, vendorBills, inventory, employees };
    },
  });

  const accounts = useMemo<PosPayOutAccount[]>(() => {
    const data = partiesQuery.data;
    if (!data) return [];

    const list: PosPayOutAccount[] = [];

    // Suppliers from inventory + outstanding vendor balances
    const vendorBalance = new Map<string, { balance: number; status: string }>();
    for (const bill of data.vendorBills) {
      const existing = vendorBalance.get(bill.supplierId);
      if (existing) {
        existing.balance += bill.balance;
        if (bill.status === "open" || existing.status === "open") existing.status = "open";
        else if (bill.status === "partial" || existing.status === "partial") existing.status = "partial";
      } else {
        vendorBalance.set(bill.supplierId, { balance: bill.balance, status: bill.status });
      }
    }
    const suppliers = data.inventory?.suppliers ?? [];
    const seenSupplierIds = new Set<string>();
    for (const supplier of suppliers) {
      if (!supplier.active) continue;
      seenSupplierIds.add(supplier.id);
      const bal = vendorBalance.get(supplier.id);
      list.push({
        kind: "supplier",
        id: supplier.id,
        name: supplier.name,
        detail: supplier.phone,
        balance: bal?.balance ?? supplier.openingBalancePkr ?? 0,
        status: bal?.status ?? null,
      });
    }
    // Vendor bills for suppliers not in inventory list
    for (const bill of data.vendorBills) {
      if (seenSupplierIds.has(bill.supplierId)) continue;
      seenSupplierIds.add(bill.supplierId);
      const bal = vendorBalance.get(bill.supplierId);
      list.push({
        kind: "supplier",
        id: bill.supplierId,
        name: bill.supplierName,
        detail: bill.invoiceNumber ? `Bill ${bill.invoiceNumber}` : bill.billRef,
        balance: bal?.balance ?? bill.balance,
        status: bal?.status ?? bill.status,
      });
    }

    // Customers from receivable invoices
    const byCustomer = new Map<string, PosPayOutAccount>();
    for (const invoice of data.invoices) {
      const key = `${invoice.customerName}|${invoice.customerPhone ?? ""}`;
      const existing = byCustomer.get(key);
      if (existing) {
        existing.balance = (existing.balance ?? 0) + invoice.balance;
        if (invoice.status === "open" || existing.status === "open") existing.status = "open";
        else if (invoice.status === "partial" || existing.status === "partial") {
          existing.status = "partial";
        }
      } else {
        byCustomer.set(key, {
          kind: "customer",
          id: key,
          name: invoice.customerName,
          detail: invoice.customerPhone,
          balance: invoice.balance,
          status: invoice.status,
        });
      }
    }
    list.push(...byCustomer.values());

    // Employees
    for (const employee of data.employees) {
      if (employee.employmentStatus === "terminated") continue;
      list.push({
        kind: "employee",
        id: employee.id,
        name: employee.displayName,
        detail: [employee.jobTitle, employee.phone].filter(Boolean).join(" · ") || null,
        balance: null,
        status: employee.employmentStatus,
      });
    }

    list.sort((a, b) => {
      const kindOrder = { supplier: 0, customer: 1, employee: 2 }[a.kind] - { supplier: 0, customer: 1, employee: 2 }[b.kind];
      if (kindOrder !== 0) return kindOrder;
      return a.name.localeCompare(b.name);
    });

    const q = accountSearch.trim().toLowerCase();
    return list.filter((a) => {
      if (partyFilter !== "all" && a.kind !== partyFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.detail ?? "").toLowerCase().includes(q) ||
        PARTY_LABEL[a.kind].toLowerCase().includes(q)
      );
    });
  }, [partiesQuery.data, accountSearch, partyFilter]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [accountSearch, partyFilter, accountPickerOpen]);

  useEffect(() => {
    if (highlightIndex >= accounts.length) {
      setHighlightIndex(Math.max(0, accounts.length - 1));
    }
  }, [accounts.length, highlightIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        if (accountPickerOpen) {
          e.preventDefault();
          setAccountPickerOpen(false);
          return;
        }
        onClose();
        return;
      }
      if (!accountPickerOpen || accounts.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(accounts.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const target = e.target as HTMLElement | null;
        const placeholder = target?.getAttribute?.("placeholder") ?? "";
        const fromSearch = placeholder.toLowerCase().includes("search");
        if (target?.tagName === "INPUT" && !fromSearch) return;
        const account = accounts[highlightIndex];
        if (!account) return;
        e.preventDefault();
        selectAccount(account);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function selectAccount(account: PosPayOutAccount): void {
    setSelectedAccount(account);
    setReason((current) => {
      const prefix = accountReasonPrefix(account);
      const trimmed = current.trim();
      if (!trimmed) return prefix;
      if (trimmed.startsWith("Supplier:") || trimmed.startsWith("Customer:") || trimmed.startsWith("Employee:")) {
        return prefix;
      }
      return trimmed;
    });
    setAccountPickerOpen(false);
    setAccountSearch("");
  }

  const mutation = useMutation({
    mutationFn: () => {
      const baseReason = reason.trim();
      const linked =
        selectedAccount && !baseReason.toLowerCase().includes(selectedAccount.name.toLowerCase())
          ? `${accountReasonPrefix(selectedAccount)} — ${baseReason}`
          : baseReason;
      return recordCashMovement({
        branchCode: branch!.code,
        sessionId: sessionQuery.data!.id,
        type: "paid_out",
        amountPkr: Number(amount),
        reason: linked,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      const who = selectedAccount ? ` → ${PARTY_LABEL[selectedAccount.kind]} ${selectedAccount.name}` : "";
      onSuccess?.(`Paid out ${Number(amount).toLocaleString()} PKR${who}.`);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const openSession = sessionQuery.data;

  return (
    <div className={modalBackdropRaisedClass} onClick={onClose} role="presentation">
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-payout-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pos-payout-title" className="text-sm font-semibold text-slate-900 dark:text-white">
              Pay out
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Remove cash from the drawer for expenses or vendors.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {sessionQuery.isLoading ? (
          <p className="mt-4 text-xs text-slate-500">Loading cash session…</p>
        ) : !openSession ? (
          <p className="mt-4 text-xs text-amber-600 dark:text-amber-300">
            No cash drawer session is open. Use Cashier in on the POS toolbar first.
          </p>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
          >
            <div>
              <button
                type="button"
                onClick={() => setAccountPickerOpen((open) => !open)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selectedAccount
                    ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
                    : "border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <span className="truncate">
                  {selectedAccount
                    ? `${PARTY_LABEL[selectedAccount.kind]} · ${selectedAccount.name}${
                        selectedAccount.detail ? ` · ${selectedAccount.detail}` : ""
                      }`
                    : "Account (optional) — Supplier, Customer, or Employee"}
                </span>
                <span className="shrink-0 text-slate-400" aria-hidden>
                  {accountPickerOpen ? "▲" : "▼"}
                </span>
              </button>

              {selectedAccount ? (
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {selectedAccount.balance != null
                      ? `Balance: ${formatPkr(selectedAccount.balance)}`
                      : PARTY_LABEL[selectedAccount.kind]}
                  </span>
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setSelectedAccount(null)}
                  >
                    Clear
                  </button>
                </div>
              ) : null}

              {accountPickerOpen ? (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setPartyFilter(filter.id)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
                          partyFilter === filter.id
                            ? "bg-amber-500/20 text-amber-800 ring-1 ring-amber-400/50 dark:text-amber-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className={`${fieldInputClass} mb-2`}
                    placeholder="Search supplier, customer, or employee…"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    autoFocus
                  />
                  <p className="mb-1 px-1 text-[10px] text-slate-500">Use ↑ ↓ keys, Enter to select</p>
                  {partiesQuery.isLoading ? (
                    <p className="px-1 py-2 text-xs text-slate-500">Loading accounts…</p>
                  ) : accounts.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-500">
                      No {partyFilter === "all" ? "accounts" : `${partyFilter}s`} found.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {accounts.map((a, index) => (
                        <li key={`${a.kind}:${a.id}`}>
                          <button
                            type="button"
                            onClick={() => selectAccount(a)}
                            className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                              index === highlightIndex
                                ? "bg-amber-100 dark:bg-amber-500/20"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="mb-0.5 inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {PARTY_LABEL[a.kind]}
                              </span>
                              <span className="mt-0.5 block truncate font-medium text-slate-900 dark:text-white">
                                {a.name}
                              </span>
                              <span className="block truncate text-slate-500">{a.detail ?? "—"}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              {a.balance != null ? (
                                <span
                                  className={`block font-semibold ${
                                    a.balance > 0
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-emerald-600 dark:text-emerald-400"
                                  }`}
                                >
                                  {formatPkr(a.balance)}
                                </span>
                              ) : (
                                <span className="block text-[10px] capitalize text-slate-400">
                                  {a.status ?? "—"}
                                </span>
                              )}
                              {a.balance != null && a.status ? (
                                <span className="block text-[10px] capitalize text-slate-400">{a.status}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <input
              className={fieldInputClass}
              type="number"
              min={1}
              placeholder="Amount (PKR)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <input
              className={fieldInputClass}
              placeholder="Reason (e.g. vendor payment)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            {error ? <p className="text-xs text-red-500">{error}</p> : null}
            <button
              type="submit"
              disabled={mutation.isPending || !amount || !reason.trim()}
              className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Record pay out
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
