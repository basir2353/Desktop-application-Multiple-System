import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";
import { PageHeader } from "../../pops/ui/PageHeader";
import { formatPkr, useStoreAccess } from "../hooks/useStore";
import {
  DEFAULT_STORE_CASH_SETUP,
  loadStoreCashSetup,
  saveStoreCashSetup,
  type StoreCashSetup,
} from "../lib/storeCashSetup";
import { getTerminalId } from "../lib/storePosSync";
import { StoreField, StoreInput } from "../ui/StoreUi";

export function StoreSetupPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const terminalId = getTerminalId();
  const [draft, setDraft] = useState<StoreCashSetup>(DEFAULT_STORE_CASH_SETUP);
  const [payInText, setPayInText] = useState("");
  const [payOutText, setPayOutText] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadStoreCashSetup(branch?.code);
    setDraft(loaded);
    setPayInText(loaded.payInReasons.join("\n"));
    setPayOutText(loaded.payOutReasons.join("\n"));
  }, [branch?.code]);

  function save(): void {
    if (!branch?.code) return;
    const next: StoreCashSetup = {
      ...draft,
      payInReasons: payInText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      payOutReasons: payOutText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };
    saveStoreCashSetup(branch.code, next);
    setDraft(loadStoreCashSetup(branch.code));
    setNotice("General Store setup saved — Sales defaults, Pay In/Out, and shifts use these values.");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="General Store setup"
        subtitle="Branch defaults for shifts, Sales (cash customer / payment), Pay In / Pay Out, and POS rules."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <h2 className="text-sm font-semibold text-white">Terminal & shift defaults</h2>
          <p className="mt-1 text-xs text-slate-500">
            This device terminal ID: <span className="font-mono text-slate-300">{terminalId}</span>
          </p>
          <div className="mt-3 space-y-3">
            <StoreField label="Default cashier name">
              <StoreInput
                value={draft.defaultCashierName}
                onChange={(e) => setDraft((d) => ({ ...d, defaultCashierName: e.target.value }))}
                placeholder="e.g. Counter 1"
              />
            </StoreField>
            <StoreField label={`Default opening cash (${formatPkr(draft.defaultOpeningCashPkr)})`}>
              <StoreInput
                type="number"
                min={0}
                value={String(draft.defaultOpeningCashPkr)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    defaultOpeningCashPkr: Number(e.target.value) || 0,
                  }))
                }
              />
            </StoreField>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={draft.autoPrintSlip}
                onChange={(e) => setDraft((d) => ({ ...d, autoPrintSlip: e.target.checked }))}
              />
              Auto-print Pay In / Pay Out slip after recording
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={draft.requireShiftForPos}
                onChange={(e) => setDraft((d) => ({ ...d, requireShiftForPos: e.target.checked }))}
              />
              Require open shift before POS Order / Pay
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
          <h2 className="text-sm font-semibold text-sky-100">Sales screen defaults</h2>
          <p className="mt-1 text-xs text-slate-500">
            Most invoices are cash. Cash payment and the default customer are pre-selected; change them only for credit sales.
          </p>
          <div className="mt-3 space-y-3">
            <StoreField label="Default customer name">
              <StoreInput
                value={draft.defaultCustomerName}
                onChange={(e) => setDraft((d) => ({ ...d, defaultCustomerName: e.target.value }))}
                placeholder="Cash Customer"
              />
            </StoreField>
            <StoreField label="Default payment method">
              <select
                value={draft.defaultPaymentMethod}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    defaultPaymentMethod: e.target.value as StoreCashSetup["defaultPaymentMethod"],
                  }))
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card / Debit</option>
                <option value="Bank Transfer">Bank Transfer / Check</option>
                <option value="Mobile Wallet">Mobile Wallet / Gift</option>
                <option value="Credit">Credit / Account</option>
              </select>
            </StoreField>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={draft.showQuickPickByDefault}
                onChange={(e) => setDraft((d) => ({ ...d, showQuickPickByDefault: e.target.checked }))}
              />
              Show Quick Pick product grid beside Sales Receipt by default
            </label>
          </div>
        </section>

      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
          <h2 className="text-sm font-semibold text-white">Quick links</h2>
          <p className="mt-1 text-xs text-slate-500">Finish store setup with these modules.</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link className="text-amber-300 hover:text-amber-200" to="/pops/store/pay-in-out">
              → Pay In / Pay Out
            </Link>
            <Link className="text-amber-300 hover:text-amber-200" to="/pops/store/shifts">
              → Shifts & cash reconciliation
            </Link>
            <Link className="text-amber-300 hover:text-amber-200" to="/pops/printer">
              → Printer & receipt template
            </Link>
            <Link className="text-amber-300 hover:text-amber-200" to="/pops/store/pos">
              → Point of sale / Sales Receipt
            </Link>
            <Link className="text-amber-300 hover:text-amber-200" to="/pops/tax">
              → Tax & compliance (FBR / PRA)
            </Link>
            <Link className="text-amber-300 hover:text-amber-200" to="/pops/settings">
              → Shared POS settings
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h2 className="text-sm font-semibold text-emerald-200">Pay In reason presets</h2>
          <p className="mt-1 text-xs text-slate-500">One reason per line — shown as quick chips.</p>
          <textarea
            className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50"
            value={payInText}
            onChange={(e) => setPayInText(e.target.value)}
          />
        </section>
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5">
          <h2 className="text-sm font-semibold text-rose-200">Pay Out reason presets</h2>
          <p className="mt-1 text-xs text-slate-500">One reason per line — vendor, expense, safe drop…</p>
          <textarea
            className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-rose-500/50"
            value={payOutText}
            onChange={(e) => setPayOutText(e.target.value)}
          />
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!branch?.code}
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          Save General Store setup
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(DEFAULT_STORE_CASH_SETUP);
            setPayInText(DEFAULT_STORE_CASH_SETUP.payInReasons.join("\n"));
            setPayOutText(DEFAULT_STORE_CASH_SETUP.payOutReasons.join("\n"));
          }}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300"
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
}
