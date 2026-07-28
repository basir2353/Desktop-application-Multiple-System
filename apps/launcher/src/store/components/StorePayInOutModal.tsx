import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { printCashMovementSlip } from "../../pops/lib/printCashMovement";
import { noticeErrorClass } from "../../pops/lib/themeClasses";
import {
  fetchStoreOpenShift,
  recordStoreCashMovement,
} from "../api/store";
import { formatPkr, useStoreAccess } from "../hooks/useStore";
import { loadStoreCashSetup } from "../lib/storeCashSetup";
import { getTerminalId } from "../lib/storePosSync";
import { StoreField, StoreInput } from "../ui/StoreUi";

type Props = {
  type: "paid_in" | "paid_out";
  onClose: () => void;
  onDone?: (message: string) => void;
};

export function StorePayInOutModal({ type, onClose, onDone }: Props): JSX.Element {
  const { branch } = useStoreAccess();
  const queryClient = useQueryClient();
  const terminalId = getTerminalId();
  const setup = loadStoreCashSetup(branch?.code);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openShiftQuery = useQuery({
    queryKey: ["store", "shift-open", branch?.code, terminalId],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreOpenShift(branch!.code, terminalId),
  });
  const openShift = openShiftQuery.data;
  const reasons = type === "paid_in" ? setup.payInReasons : setup.payOutReasons;
  const title = type === "paid_in" ? "Pay In" : "Pay Out";

  const mutation = useMutation({
    mutationFn: () =>
      recordStoreCashMovement({
        branchCode: branch!.code,
        shiftId: openShift!.id,
        type,
        amountPkr: Number(amount),
        reason: reason.trim(),
        recordedBy: openShift?.cashierName,
      }),
    onSuccess: async () => {
      const amountNum = Number(amount);
      void queryClient.invalidateQueries({ queryKey: ["store"] });
      if (setup.autoPrintSlip && branch) {
        try {
          await printCashMovementSlip({
            branchName: branch.name ?? "Store",
            branchCode: branch.code,
            sessionRef: openShift?.cashierName,
            type,
            amountPkr: amountNum,
            reason: reason.trim(),
          });
        } catch {
          // ignore
        }
      }
      onDone?.(
        type === "paid_in"
          ? `Pay In ${formatPkr(amountNum)} recorded`
          : `Pay Out ${formatPkr(amountNum)} recorded`,
      );
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <button type="button" className="text-slate-400 hover:text-white" onClick={onClose}>
            ×
          </button>
        </div>
        {error ? <div className={`mt-3 ${noticeErrorClass}`}>{error}</div> : null}

        {!openShift ? (
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <p>No open shift on this terminal. Open a shift first.</p>
            <Link
              to="/pops/store/pay-in-out"
              className="inline-flex rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
              onClick={onClose}
            >
              Open Pay In / Pay Out
            </Link>
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <p className="text-xs text-slate-500">
              Shift: <span className="text-slate-300">{openShift.cashierName}</span>
            </p>
            <StoreField label="Amount (PKR)">
              <StoreInput
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </StoreField>
            <StoreField label="Reason">
              <StoreInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder={type === "paid_in" ? "Float top-up…" : "Vendor / expense…"}
              />
            </StoreField>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] text-slate-300 ring-1 ring-slate-700"
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !amount || !reason.trim()}
                className={`rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-50 ${
                  type === "paid_in" ? "bg-emerald-600" : "bg-rose-600"
                }`}
              >
                Record {title}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
