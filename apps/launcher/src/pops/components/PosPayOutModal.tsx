import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchCustomerInvoices, fetchOpenCashSession, recordCashMovement } from "../api/accounting";
import { formatPkr } from "../hooks/useAccounting";
import { fieldInputClass, modalBackdropRaisedClass } from "../lib/themeClasses";
import { usePopsStore } from "../../stores/popsStore";

type Props = {
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

type PosPayOutAccount = {
  customerName: string;
  customerPhone: string | null;
  balance: number;
  status: "open" | "partial" | "paid";
};

export function PosPayOutModal({ onClose, onSuccess }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<PosPayOutAccount | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

  const invoicesQuery = useQuery({
    queryKey: ["accounting", "receivable", branch?.code],
    enabled: Boolean(branch?.code) && accountPickerOpen,
    queryFn: () => fetchCustomerInvoices(branch!.code),
  });

  const accounts = useMemo<PosPayOutAccount[]>(() => {
    const byCustomer = new Map<string, PosPayOutAccount>();
    for (const invoice of invoicesQuery.data ?? []) {
      const key = `${invoice.customerName}|${invoice.customerPhone ?? ""}`;
      const existing = byCustomer.get(key);
      if (existing) {
        existing.balance += invoice.balance;
        if (invoice.status === "open" || existing.status === "open") existing.status = "open";
        else if (invoice.status === "partial" || existing.status === "partial") existing.status = "partial";
      } else {
        byCustomer.set(key, {
          customerName: invoice.customerName,
          customerPhone: invoice.customerPhone,
          balance: invoice.balance,
          status: invoice.status,
        });
      }
    }
    const list = [...byCustomer.values()];
    const q = accountSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) => a.customerName.toLowerCase().includes(q) || (a.customerPhone ?? "").includes(q),
    );
  }, [invoicesQuery.data, accountSearch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: () =>
      recordCashMovement({
        branchCode: branch!.code,
        sessionId: sessionQuery.data!.id,
        type: "paid_out",
        amountPkr: Number(amount),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      onSuccess?.(`Paid out ${Number(amount).toLocaleString()} PKR.`);
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
                    ? `${selectedAccount.customerName}${selectedAccount.customerPhone ? ` · ${selectedAccount.customerPhone}` : ""}`
                    : "Account (optional) — link to a customer"}
                </span>
                <span className="shrink-0 text-slate-400" aria-hidden>
                  {accountPickerOpen ? "▲" : "▼"}
                </span>
              </button>

              {selectedAccount ? (
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Outstanding balance: {formatPkr(selectedAccount.balance)}</span>
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
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                  <input
                    className={`${fieldInputClass} mb-2`}
                    placeholder="Search accounts…"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    autoFocus
                  />
                  {invoicesQuery.isLoading ? (
                    <p className="px-1 py-2 text-xs text-slate-500">Loading accounts…</p>
                  ) : accounts.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-slate-500">No customer accounts found.</p>
                  ) : (
                    <ul className="space-y-1">
                      {accounts.map((a) => (
                        <li key={`${a.customerName}|${a.customerPhone ?? ""}`}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccount(a);
                              setReason((current) => (current.trim() ? current : `Account: ${a.customerName}`));
                              setAccountPickerOpen(false);
                              setAccountSearch("");
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-900 dark:text-white">
                                {a.customerName}
                              </span>
                              <span className="block truncate text-slate-500">{a.customerPhone ?? "No phone"}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span
                                className={`block font-semibold ${
                                  a.balance > 0
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {formatPkr(a.balance)}
                              </span>
                              <span className="block text-[10px] capitalize text-slate-400">{a.status}</span>
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
