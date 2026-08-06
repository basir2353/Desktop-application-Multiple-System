import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@platform/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createExpense } from "../api/accounting";
import { createSupplier } from "../api/inventory";
import { fieldInputClass, modalBackdropRaisedClass } from "../lib/themeClasses";
import { usePopsStore } from "../../stores/popsStore";

type AccountKind = "supplier" | "expense";

type Props = {
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

export function PosCreateAccountModal({ onClose, onSuccess }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<AccountKind>("supplier");
  const [error, setError] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");

  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("Other");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!branch?.code) throw new Error("Select a branch first.");
      if (kind === "supplier") {
        const name = supplierName.trim();
        if (!name) throw new Error("Supplier name required.");
        return {
          kind: "supplier" as const,
          row: await createSupplier({
            branchCode: branch.code,
            name,
            phone: supplierPhone.trim() || undefined,
            address: supplierAddress.trim() || undefined,
          }),
        };
      }
      const amount = Math.round(Number(expenseAmount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Expense amount must be greater than 0.");
      }
      return {
        kind: "expense" as const,
        row: await createExpense({
          branchCode: branch.code,
          category: expenseCategory,
          amount,
          expenseDate: new Date().toISOString().slice(0, 10),
          vendor: expenseVendor.trim() || undefined,
          description: expenseDescription.trim() || undefined,
          recurring: false,
        }),
      };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      void queryClient.invalidateQueries({ queryKey: ["pos", "payout-parties"] });
      const message =
        result.kind === "supplier"
          ? `Supplier “${result.row.name}” created.`
          : `Expense ${result.row.expenseRef} recorded (${result.row.category}).`;
      onSuccess?.(message);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className={modalBackdropRaisedClass} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Create account</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Quick add from POS — Supplier or Expense, bina Accounting page pe gaye.
            </p>
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

        <div className="mt-3 flex gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(
            [
              { id: "supplier" as const, label: "Supplier" },
              { id: "expense" as const, label: "Expense" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setKind(tab.id);
                setError(null);
              }}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                kind === tab.id
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          {kind === "supplier" ? (
            <>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Name</span>
                <input
                  className={fieldInputClass}
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Supplier name"
                  autoFocus
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Phone</span>
                <input
                  className={fieldInputClass}
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Address</span>
                <input
                  className={fieldInputClass}
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  placeholder="Optional"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Category</span>
                <select
                  className={fieldInputClass}
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Amount (PKR)</span>
                <input
                  className={fieldInputClass}
                  type="number"
                  min={1}
                  step={1}
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  required
                  autoFocus
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Vendor / payee</span>
                <input
                  className={fieldInputClass}
                  value={expenseVendor}
                  onChange={(e) => setExpenseVendor(e.target.value)}
                  placeholder="Optional account / shop name"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Note</span>
                <input
                  className={fieldInputClass}
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  placeholder="Optional"
                />
              </label>
            </>
          )}

          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !branch?.code}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : kind === "supplier" ? "Create supplier" : "Create expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
