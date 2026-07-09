import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Bill, CashSessionLive } from "@platform/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { closeCashSession, fetchOpenCashSession, openCashSession } from "../api/accounting";
import {
  emptyDenominationQty,
  formatCashAmount,
  PKR_CASH_DENOMINATIONS,
  rowTotalForDenomination,
  sumDenominationCash,
} from "../lib/cashDenominations";
import { buildSessionPaymentGroups } from "../lib/posCashierReconcile";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";

export type PosCashierMode = "in" | "out";

type Props = {
  mode: PosCashierMode;
  orders: Bill[];
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

type PaymentPanelProps = {
  title: string;
  group: ReturnType<typeof buildSessionPaymentGroups>["creditCard"];
};

function formatPosTimestamp(date = new Date()): string {
  return date
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
    .replace(",", "");
}

function PaymentPanel({ title, group }: PaymentPanelProps): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-slate-500/80 bg-slate-100 dark:bg-slate-800/90">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-400/60 bg-slate-300/90 px-2 py-1 text-[11px] font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
        <span>
          {title} ({group.count})
        </span>
        <span className="tabular-nums">Total {formatCashAmount(group.total)}</span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 text-[10px]">
        {group.items.length === 0 ? (
          <li className="px-1 py-2 text-slate-500 dark:text-slate-400">No transactions</li>
        ) : (
          group.items.map((item) => (
            <li
              key={`${item.ref}-${item.at}-${item.amount}`}
              className="flex items-center justify-between gap-2 border-b border-slate-300/50 py-1 text-slate-700 last:border-0 dark:border-slate-600/50 dark:text-slate-200"
            >
              <span className="truncate font-medium">{item.ref}</span>
              <span className="shrink-0 tabular-nums text-red-600 dark:text-red-400">
                {item.amount.toLocaleString()}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function PosCashierModal({ mode, orders, onClose, onSuccess }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const claims = useSessionStore((s) => s.claims);
  const queryClient = useQueryClient();

  const [now, setNow] = useState(() => new Date());
  const [qtyByValue, setQtyByValue] = useState(emptyDenominationQty);
  const [activeDenomIndex, setActiveDenomIndex] = useState(0);
  const [manualCash, setManualCash] = useState("");
  const [settlement, setSettlement] = useState(false);
  const [aggregateAllPos, setAggregateAllPos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

  const openSession = sessionQuery.data;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const operatorName = claims?.sub?.split("@")[0] ?? displayRole;
  const cashTotal = useMemo(() => sumDenominationCash(qtyByValue), [qtyByValue]);
  const countedCash = manualCash.trim() !== "" ? Number(manualCash) || 0 : cashTotal;

  const paymentGroups = useMemo(
    () => (openSession ? buildSessionPaymentGroups(orders, openSession.openedAt) : null),
    [openSession, orders],
  );

  const openMutation = useMutation({
    mutationFn: () => openCashSession({ branchCode: branch!.code, openingFloat: countedCash }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      onSuccess?.(`Cashier in complete — opening float Rs ${countedCash.toLocaleString()}.`);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => {
      const notes = [
        settlement ? "Settlement" : null,
        aggregateAllPos ? "Aggregate all POS" : null,
      ]
        .filter(Boolean)
        .join("; ");
      return closeCashSession(openSession!.id, {
        countedCash,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      const expected = openSession?.liveExpectedCash ?? 0;
      const variance = countedCash - expected;
      const varianceLabel =
        variance === 0
          ? "balanced"
          : variance > 0
            ? `over Rs ${variance.toLocaleString()}`
            : `short Rs ${Math.abs(variance).toLocaleString()}`;
      onSuccess?.(`Cashier out complete — counted Rs ${countedCash.toLocaleString()} (${varianceLabel}).`);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const activeDenom = PKR_CASH_DENOMINATIONS[activeDenomIndex];

  const setActiveQty = useCallback((value: string) => {
    if (!activeDenom) return;
    setQtyByValue((prev) => ({ ...prev, [activeDenom.value]: value }));
    setManualCash("");
  }, [activeDenom]);

  const appendDigit = useCallback(
    (digit: string) => {
      const current = qtyByValue[activeDenom?.value ?? 0] ?? "";
      setActiveQty(`${current}${digit}`.replace(/^0+(?=\d)/, ""));
    },
    [activeDenom, qtyByValue, setActiveQty],
  );

  const clearActive = useCallback(() => {
    setActiveQty("");
  }, [setActiveQty]);

  const confirmActive = useCallback(() => {
    if (activeDenomIndex < PKR_CASH_DENOMINATIONS.length - 1) {
      setActiveDenomIndex((i) => i + 1);
    }
  }, [activeDenomIndex]);

  function handleNext(): void {
    setError(null);
    if (mode === "in") {
      if (openSession) {
        onClose();
        return;
      }
      openMutation.mutate();
      return;
    }
    if (!openSession) {
      setError("No open cash session. Complete Cashier in first.");
      return;
    }
    closeMutation.mutate();
  }

  const isSubmitting = openMutation.isPending || closeMutation.isPending;
  const isActiveShiftView = mode === "in" && Boolean(openSession);
  const title = mode === "in" ? "Cashier-In" : "Cashier-Out";
  const nextLabel = isSubmitting ? "…" : isActiveShiftView ? "Continue" : "Next";
  const sessionBanner = openSession
    ? `Cash Tray 1 / Operation Initiator: ${openSession.openedBy} / ${formatPosTimestamp(new Date(openSession.openedAt))}`
    : `Cash Tray 1 / Operation Initiator: ${operatorName} / ${formatPosTimestamp(now)}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-600 bg-slate-200 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-cashier-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-500/80 bg-slate-700 px-3 py-2 text-white">
          <h2 id="pos-cashier-title" className="text-sm font-semibold tracking-wide">
            {title}
          </h2>
          <div className="rounded border border-slate-500 bg-slate-800 px-3 py-1 font-mono text-xs tabular-nums">
            {formatPosTimestamp(now)}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded bg-slate-600 text-lg leading-none hover:bg-slate-500"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Session info bar */}
        <div className="shrink-0 border-b border-slate-400/70 bg-slate-300 px-3 py-1.5 text-center text-[11px] font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
          {sessionBanner}
        </div>

        {sessionQuery.isLoading ? (
          <p className="p-6 text-sm text-slate-600 dark:text-slate-400">Loading cash session…</p>
        ) : mode === "out" && !openSession ? (
          <div className="space-y-4 p-6">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              No cash drawer session is open. Complete Cashier in before cashier out.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div
              className={`grid min-h-0 flex-1 gap-2 overflow-hidden p-2 ${
                mode === "out"
                  ? "grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
                  : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto]"
              }`}
            >
              {/* Cash denomination panel */}
              <CashDenominationPanel
                qtyByValue={qtyByValue}
                activeDenomIndex={activeDenomIndex}
                onSelectRow={setActiveDenomIndex}
                expectedCash={mode === "out" ? openSession?.liveExpectedCash : openSession?.liveExpectedCash}
                session={openSession}
                showActiveSession={isActiveShiftView}
              />

              {mode === "out" && paymentGroups ? (
                <>
                  <div className="flex min-h-[8rem] flex-col gap-2 lg:min-h-0">
                    <PaymentPanel title="Credit Card" group={paymentGroups.creditCard} />
                    <PaymentPanel title="Terminal Credit" group={paymentGroups.terminalCredit} />
                  </div>
                  <div className="flex min-h-[8rem] flex-col gap-2 lg:min-h-0">
                    <PaymentPanel title="Check" group={paymentGroups.check} />
                    <PaymentPanel title="House Account" group={paymentGroups.houseAccount} />
                  </div>
                </>
              ) : null}

              {/* Numpad column */}
              <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[11rem]">
                <PosCashierNumpad
                  onDigit={appendDigit}
                  onDoubleZero={() => appendDigit("00")}
                  onClear={clearActive}
                  onOk={confirmActive}
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleNext}
                  className="rounded-lg border border-slate-500 bg-gradient-to-b from-slate-100 to-slate-300 py-3 text-sm font-bold text-slate-800 shadow hover:from-white hover:to-slate-200 disabled:opacity-50 dark:from-slate-600 dark:to-slate-700 dark:text-white"
                >
                  {nextLabel}
                </button>

                {mode === "out" ? (
                  <div className="space-y-2 rounded border border-slate-400/70 bg-slate-100 p-2 text-[11px] dark:border-slate-600 dark:bg-slate-800">
                    <label className="flex cursor-pointer items-center gap-2 text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={settlement}
                        onChange={(e) => setSettlement(e.target.checked)}
                        className="rounded border-slate-400"
                      />
                      Settlement
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={aggregateAllPos}
                        onChange={(e) => setAggregateAllPos(e.target.checked)}
                        className="rounded border-slate-400"
                      />
                      Aggregate All POS
                    </label>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer: manual cash + summary */}
            <div className="shrink-0 border-t border-slate-400/70 bg-slate-300/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              {isActiveShiftView && openSession ? (
                <div className="mb-2 rounded border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <span className="font-semibold">Active shift {openSession.sessionRef}</span>
                  <span className="mx-2 text-emerald-700/60 dark:text-emerald-300/60">·</span>
                  Opening float{" "}
                  <span className="font-semibold tabular-nums">
                    Rs {openSession.openingFloat.toLocaleString()}
                  </span>
                  <span className="mx-2 text-emerald-700/60 dark:text-emerald-300/60">·</span>
                  Cash sales{" "}
                  <span className="font-semibold tabular-nums">
                    Rs {openSession.cashSales.toLocaleString()}
                  </span>
                  <span className="mx-2 text-emerald-700/60 dark:text-emerald-300/60">·</span>
                  In drawer now{" "}
                  <span className="font-semibold tabular-nums">
                    Rs {openSession.liveExpectedCash.toLocaleString()}
                  </span>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                  <span className="shrink-0">Cash</span>
                  <input
                    type="number"
                    min={0}
                    placeholder={
                      isActiveShiftView && openSession
                        ? String(openSession.openingFloat)
                        : String(cashTotal)
                    }
                    value={manualCash}
                    onChange={(e) => setManualCash(e.target.value)}
                    className="w-full rounded border border-slate-400 bg-white px-2 py-1.5 tabular-nums text-slate-900 outline-none focus:border-amber-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  />
                </label>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {isActiveShiftView && openSession ? (
                    <>
                      <span className="font-semibold">Opening float: </span>
                      <span className="tabular-nums">Rs {formatCashAmount(openSession.openingFloat)}</span>
                      <span className="mx-2 text-slate-500">|</span>
                      <span className="font-semibold">Counted now: </span>
                      <span className="tabular-nums">Rs {formatCashAmount(countedCash)}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Counted: </span>
                      <span className="tabular-nums">Rs {formatCashAmount(countedCash)}</span>
                    </>
                  )}
                  {mode === "out" && openSession ? (
                    <>
                      <span className="mx-2 text-slate-500">|</span>
                      <span className="font-semibold">Expected: </span>
                      <span className="tabular-nums">Rs {formatCashAmount(openSession.liveExpectedCash)}</span>
                      <span className="mx-2 text-slate-500">|</span>
                      <span className="font-semibold">Variance: </span>
                      <span
                        className={`tabular-nums ${
                          countedCash - openSession.liveExpectedCash === 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        Rs {formatCashAmount(countedCash - openSession.liveExpectedCash)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type CashDenominationPanelProps = {
  qtyByValue: Record<number, string>;
  activeDenomIndex: number;
  onSelectRow: (index: number) => void;
  expectedCash?: number;
  session: CashSessionLive | null | undefined;
  showActiveSession?: boolean;
};

function CashDenominationPanel({
  qtyByValue,
  activeDenomIndex,
  onSelectRow,
  expectedCash,
  session,
  showActiveSession = false,
}: CashDenominationPanelProps): JSX.Element {
  const cashTotal = sumDenominationCash(qtyByValue);
  const headerTotal = showActiveSession && session ? session.openingFloat : cashTotal;

  return (
    <div className="flex min-h-[16rem] flex-col overflow-hidden rounded border border-slate-500/80 bg-white dark:border-slate-600 dark:bg-slate-900/50 lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-400/70 bg-slate-300/90 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
        <span>Cash</span>
        <span className="tabular-nums">Total {formatCashAmount(headerTotal)}</span>
      </div>

      {showActiveSession && session ? (
        <div className="shrink-0 border-b border-emerald-300/60 bg-emerald-50 px-3 py-1.5 text-[10px] text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          Active session {session.sessionRef} · Opened {formatPosTimestamp(new Date(session.openedAt))} by{" "}
          {session.openedBy} · Opening float Rs {session.openingFloat.toLocaleString()} · Cash sales Rs{" "}
          {session.cashSales.toLocaleString()} · Drawer Rs {session.liveExpectedCash.toLocaleString()}
        </div>
      ) : session && expectedCash != null ? (
        <div className="shrink-0 border-b border-slate-200 bg-amber-50 px-3 py-1 text-[10px] text-amber-900 dark:border-slate-700 dark:bg-amber-500/10 dark:text-amber-200">
          Session {session.sessionRef} · Float Rs {session.openingFloat.toLocaleString()} · Sales Rs{" "}
          {session.cashSales.toLocaleString()} · Expected Rs {expectedCash.toLocaleString()}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-200/80 text-left text-[10px] uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <th className="px-3 py-1.5 font-semibold">Denomination</th>
              <th className="px-2 py-1.5 font-semibold">Qty</th>
              <th className="px-3 py-1.5 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {PKR_CASH_DENOMINATIONS.map((denom, index) => {
              const isActive = index === activeDenomIndex;
              const qty = qtyByValue[denom.value] ?? "";
              const rowTotal = rowTotalForDenomination(denom.value, qty);
              return (
                <tr
                  key={denom.value}
                  className={`border-b border-slate-200 dark:border-slate-700/80 ${
                    isActive ? "bg-amber-100 dark:bg-amber-500/15" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{denom.label}</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      readOnly
                      value={qty}
                      onFocus={() => onSelectRow(index)}
                      onClick={() => onSelectRow(index)}
                      className={`w-full rounded border px-2 py-1.5 text-center tabular-nums outline-none ${
                        isActive
                          ? "border-amber-500 bg-amber-50 text-slate-900 ring-2 ring-amber-400/40 dark:bg-amber-500/10 dark:text-white"
                          : "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                    {rowTotal > 0 ? rowTotal.toLocaleString() : "0"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type NumpadProps = {
  onDigit: (digit: string) => void;
  onDoubleZero: () => void;
  onClear: () => void;
  onOk: () => void;
};

function PosCashierNumpad({ onDigit, onDoubleZero, onClear, onOk }: NumpadProps): JSX.Element {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "CLEAR"] as const;

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            if (key === "CLEAR") onClear();
            else if (key === "00") onDoubleZero();
            else onDigit(key);
          }}
          className={`rounded border border-slate-500/80 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-white dark:border-slate-600 dark:hover:bg-slate-700 ${
            key === "CLEAR"
              ? "col-span-1 bg-slate-300 text-[10px] text-slate-800 dark:bg-slate-600 dark:text-white"
              : "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white"
          }`}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={onOk}
        className="col-span-3 rounded border border-slate-500/80 bg-slate-300 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
      >
        OK
      </button>
    </div>
  );
}
