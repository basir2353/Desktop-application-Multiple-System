import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchOpenCashSession, recordCashMovement } from "../api/accounting";
import { fieldInputClass, modalBackdropRaisedClass } from "../lib/themeClasses";
import { usePopsStore } from "../../stores/popsStore";

type Props = {
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

export function PosPayOutModal({ onClose, onSuccess }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

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
            No cash drawer session is open. Open a shift under Cash drawer first.
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
