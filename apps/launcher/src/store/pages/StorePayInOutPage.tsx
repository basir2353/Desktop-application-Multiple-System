import type { StoreCashMovement, StoreShift } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { printCashMovementSlip } from "../../pops/lib/printCashMovement";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { Badge } from "../../pops/ui/Badge";
import { PageHeader } from "../../pops/ui/PageHeader";
import { SimpleTable } from "../../pops/ui/SimpleTable";
import {
  closeStoreShift,
  fetchStoreCashMovements,
  fetchStoreOpenShift,
  fetchStoreShifts,
  openStoreShift,
  recordStoreCashMovement,
} from "../api/store";
import { formatPkr, useStoreAccess } from "../hooks/useStore";
import { loadStoreCashSetup } from "../lib/storeCashSetup";
import { getTerminalId } from "../lib/storePosSync";
import { StoreField, StoreInput, StoreSelect } from "../ui/StoreUi";

function sumMovements(rows: StoreCashMovement[], type: "paid_in" | "paid_out"): number {
  return rows.filter((m) => m.type === type).reduce((s, m) => s + m.amountPkr, 0);
}

export function StorePayInOutPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const queryClient = useQueryClient();
  const terminalId = getTerminalId();
  const setup = loadStoreCashSetup(branch?.code);

  const [cashierName, setCashierName] = useState(setup.defaultCashierName);
  const [openingCash, setOpeningCash] = useState(String(setup.defaultOpeningCashPkr));
  const [paidType, setPaidType] = useState<"paid_in" | "paid_out">("paid_in");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidReason, setPaidReason] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const openShift = openShiftQuery.data;

  const movementsQuery = useQuery({
    queryKey: ["store", "cash-movements", openShift?.id],
    enabled: Boolean(openShift?.id),
    queryFn: () => fetchStoreCashMovements(openShift!.id),
  });

  const movements = movementsQuery.data ?? [];
  const paidInTotal = useMemo(() => sumMovements(movements, "paid_in"), [movements]);
  const paidOutTotal = useMemo(() => sumMovements(movements, "paid_out"), [movements]);
  const runningExpected = useMemo(() => {
    if (!openShift) return 0;
    return openShift.openingCashPkr + openShift.totalSalesPkr + paidInTotal - paidOutTotal;
  }, [openShift, paidInTotal, paidOutTotal]);

  function invalidateAll(): void {
    void queryClient.invalidateQueries({ queryKey: ["store"] });
  }

  const openMutation = useMutation({
    mutationFn: () =>
      openStoreShift({
        branchCode: branch!.code,
        cashierName: cashierName.trim(),
        openingCashPkr: Number(openingCash) || 0,
        terminalId,
      }),
    onSuccess: () => {
      invalidateAll();
      setError(null);
      setNotice("Shift opened — you can record Pay In / Pay Out.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeStoreShift(openShift!.id, { closingCashPkr: Number(closingCash) }),
    onSuccess: () => {
      invalidateAll();
      setClosingCash("");
      setError(null);
      setNotice("Shift closed and cash reconciled.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const paidMutation = useMutation({
    mutationFn: (vars: { type: "paid_in" | "paid_out"; amountPkr: number; reason: string }) =>
      recordStoreCashMovement({
        branchCode: branch!.code,
        shiftId: openShift!.id,
        type: vars.type,
        amountPkr: vars.amountPkr,
        reason: vars.reason,
        recordedBy: openShift?.cashierName,
      }),
    onSuccess: async (_data, vars) => {
      invalidateAll();
      void movementsQuery.refetch();
      setPaidAmount("");
      setPaidReason("");
      setError(null);
      setNotice(
        vars.type === "paid_in"
          ? `Pay In recorded: ${formatPkr(vars.amountPkr)}`
          : `Pay Out recorded: ${formatPkr(vars.amountPkr)}`,
      );
      if (setup.autoPrintSlip && branch) {
        try {
          await printCashMovementSlip({
            branchName: branch.name ?? "Store",
            branchCode: branch.code,
            sessionRef: openShift?.cashierName,
            type: vars.type,
            amountPkr: vars.amountPkr,
            reason: vars.reason,
          });
        } catch {
          // print is best-effort
        }
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  function submitMovement(type: "paid_in" | "paid_out"): void {
    const amountPkr = Number(paidAmount);
    const reason = paidReason.trim();
    if (!amountPkr || !reason) {
      setError("Enter amount and reason.");
      return;
    }
    setPaidType(type);
    paidMutation.mutate({ type, amountPkr, reason });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pay In / Pay Out"
        subtitle="Cash drawer movements for the open shift — vendor payments, float top-ups, and safe drops."
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          to="/pops/store/shifts"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500 hover:text-white"
        >
          Shifts & reconciliation
        </Link>
        <Link
          to="/pops/store/setup"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500 hover:text-white"
        >
          General Store setup
        </Link>
      </div>

      {error ? <div className={noticeErrorClass}>{error}</div> : null}
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}

      {!openShift ? (
        <form
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            openMutation.mutate();
          }}
        >
          <h2 className="text-sm font-semibold text-amber-100">Open a shift first</h2>
          <p className="mt-1 text-xs text-slate-400">
            Pay In / Pay Out needs an active cash shift on terminal <span className="font-mono text-slate-300">{terminalId}</span>.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <StoreField label="Cashier name">
              <StoreInput
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Cashier"
                required
              />
            </StoreField>
            <StoreField label="Opening cash">
              <StoreInput
                type="number"
                min={0}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
              />
            </StoreField>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={!cashierName.trim() || openMutation.isPending}
                className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
              >
                Start shift
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Cashier" value={openShift.cashierName} />
            <StatCard label="Opening" value={formatPkr(openShift.openingCashPkr)} />
            <StatCard label="Pay In" value={`+${formatPkr(paidInTotal)}`} tone="good" />
            <StatCard label="Pay Out" value={`−${formatPkr(paidOutTotal)}`} tone="warn" />
            <StatCard label="Expected in drawer" value={formatPkr(runningExpected)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <form
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                submitMovement("paid_in");
              }}
            >
              <h2 className="text-sm font-semibold text-emerald-200">Pay In</h2>
              <p className="mt-1 text-xs text-slate-400">Add cash to the drawer (float, owner deposit, bank).</p>
              <div className="mt-3 space-y-2">
                <StoreField label="Amount (PKR)">
                  <StoreInput
                    type="number"
                    min={1}
                    value={paidType === "paid_in" ? paidAmount : ""}
                    onFocus={() => setPaidType("paid_in")}
                    onChange={(e) => {
                      setPaidType("paid_in");
                      setPaidAmount(e.target.value);
                    }}
                    required
                  />
                </StoreField>
                <StoreField label="Reason">
                  <StoreInput
                    value={paidType === "paid_in" ? paidReason : ""}
                    onFocus={() => setPaidType("paid_in")}
                    onChange={(e) => {
                      setPaidType("paid_in");
                      setPaidReason(e.target.value);
                    }}
                    placeholder="Why is cash coming in?"
                    required
                  />
                </StoreField>
                <div className="flex flex-wrap gap-1.5">
                  {setup.payInReasons.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] text-slate-300 ring-1 ring-slate-700 hover:ring-emerald-500/50"
                      onClick={() => {
                        setPaidType("paid_in");
                        setPaidReason(r);
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={paidMutation.isPending || !paidAmount || !paidReason.trim()}
                  className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Record Pay In
                </button>
              </div>
            </form>

            <form
              className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                submitMovement("paid_out");
              }}
            >
              <h2 className="text-sm font-semibold text-rose-200">Pay Out</h2>
              <p className="mt-1 text-xs text-slate-400">Remove cash (vendor, expense, safe drop).</p>
              <div className="mt-3 space-y-2">
                <StoreField label="Amount (PKR)">
                  <StoreInput
                    type="number"
                    min={1}
                    value={paidType === "paid_out" ? paidAmount : ""}
                    onFocus={() => setPaidType("paid_out")}
                    onChange={(e) => {
                      setPaidType("paid_out");
                      setPaidAmount(e.target.value);
                    }}
                    required
                  />
                </StoreField>
                <StoreField label="Reason">
                  <StoreInput
                    value={paidType === "paid_out" ? paidReason : ""}
                    onFocus={() => setPaidType("paid_out")}
                    onChange={(e) => {
                      setPaidType("paid_out");
                      setPaidReason(e.target.value);
                    }}
                    placeholder="Why is cash leaving?"
                    required
                  />
                </StoreField>
                <div className="flex flex-wrap gap-1.5">
                  {setup.payOutReasons.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] text-slate-300 ring-1 ring-slate-700 hover:ring-rose-500/50"
                      onClick={() => {
                        setPaidType("paid_out");
                        setPaidReason(r);
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={paidMutation.isPending || !paidAmount || !paidReason.trim()}
                  className="w-full rounded-lg bg-rose-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Record Pay Out
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Close shift</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Count drawer cash and reconcile. Expected ≈ {formatPkr(runningExpected)}.
                </p>
              </div>
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  closeMutation.mutate();
                }}
              >
                <StoreField label="Counted cash">
                  <StoreInput
                    type="number"
                    min={0}
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    required
                  />
                </StoreField>
                <button
                  type="submit"
                  disabled={!closingCash || closeMutation.isPending}
                  className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  Close & reconcile
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">This shift — movements</h2>
            <SimpleTable<StoreCashMovement>
              rowKey={(r) => r.id}
              columns={[
                {
                  key: "type",
                  header: "Type",
                  render: (r) => (
                    <Badge tone={r.type === "paid_in" ? "success" : "danger"}>
                      {r.type === "paid_in" ? "Pay In" : "Pay Out"}
                    </Badge>
                  ),
                },
                {
                  key: "amountPkr",
                  header: "Amount",
                  render: (r) => (
                    <span className={r.type === "paid_in" ? "text-emerald-400" : "text-rose-400"}>
                      {r.type === "paid_in" ? "+" : "−"}
                      {formatPkr(r.amountPkr)}
                    </span>
                  ),
                },
                { key: "reason", header: "Reason" },
                {
                  key: "createdAt",
                  header: "Time",
                  render: (r) => new Date(r.createdAt).toLocaleString(),
                },
              ]}
              rows={movements}
            />
          </div>
        </>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Recent shifts</h2>
        <SimpleTable<StoreShift>
          rowKey={(r) => r.id}
          columns={[
            { key: "cashierName", header: "Cashier" },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "open" ? "success" : "neutral"}>{r.status}</Badge>
              ),
            },
            {
              key: "totalSalesPkr",
              header: "Sales",
              render: (r) => formatPkr(r.totalSalesPkr),
            },
            {
              key: "expectedCashPkr",
              header: "Expected",
              render: (r) => (r.expectedCashPkr != null ? formatPkr(r.expectedCashPkr) : "—"),
            },
            {
              key: "cashDifferencePkr",
              header: "Variance",
              render: (r) => (r.cashDifferencePkr != null ? formatPkr(r.cashDifferencePkr) : "—"),
            },
            {
              key: "openedAt",
              header: "Opened",
              render: (r) => new Date(r.openedAt).toLocaleString(),
            },
          ]}
          rows={(shiftsQuery.data ?? []).slice(0, 12)}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 text-sm font-semibold ${
          tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-rose-400" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
