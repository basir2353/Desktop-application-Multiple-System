/** One place for receipt / KOT / paper customization. */

import { useEffect, useState } from "react";
import { BillCustomizationPanel } from "./BillCustomizationPanel";
import { KotCustomizationPanel } from "./KotCustomizationPanel";
import { ThermalPrintSettingsPanel } from "./ThermalPrintSettingsPanel";
import { IconPalette, IconPrinter, IconReceipt } from "./printerUiIcons";
import { usePopsStore } from "../../stores/popsStore";
import { useActiveSystemId } from "../../hooks/useActiveSystemId";
import {
  BILL_PRINT_SETTINGS_CHANGED_EVENT,
  loadBillPrintSettings,
  saveBillPrintSettings,
  type BillPrintSettings,
} from "../lib/billPrintSettings";

export type CustomizeSub = "receipt" | "kot" | "paper";

const SUBS: { id: CustomizeSub; label: string; hint: string; Icon: typeof IconReceipt }[] = [
  { id: "receipt", label: "Receipt / Bill", hint: "Customer slip layout & fields", Icon: IconReceipt },
  { id: "kot", label: "Kitchen (KOT)", hint: "Station ticket layout", Icon: IconPrinter },
  { id: "paper", label: "Paper & preview", hint: "Width, margins, test print", Icon: IconPalette },
];

type Props = {
  branchCode: string;
  notify?: (message: string) => void;
  initialSub?: CustomizeSub;
};

export function PrintCustomizeHub({ branchCode, notify, initialSub = "receipt" }: Props): JSX.Element {
  const [sub, setSub] = useState<CustomizeSub>(initialSub);
  const branchName = usePopsStore((s) => s.branch?.name) ?? branchCode;
  const systemId = useActiveSystemId();
  const kotVariant = systemId === "general-store" ? "store" : "restaurant";
  const [billSettings, setBillSettings] = useState<BillPrintSettings>(() =>
    loadBillPrintSettings(branchCode),
  );

  useEffect(() => {
    setBillSettings(loadBillPrintSettings(branchCode));
    setSub(initialSub);
  }, [branchCode, initialSub]);

  useEffect(() => {
    function onBillChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!detail?.branchCode || detail.branchCode === branchCode) {
        setBillSettings(loadBillPrintSettings(branchCode));
      }
    }
    window.addEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onBillChanged);
    return () => window.removeEventListener(BILL_PRINT_SETTINGS_CHANGED_EVENT, onBillChanged);
  }, [branchCode]);

  function persistBill(next: BillPrintSettings): void {
    saveBillPrintSettings(branchCode, next);
    setBillSettings(next);
    notify?.("Receipt layout saved.");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 to-slate-950/60 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
            <IconPalette className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Print customization</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              Receipt, kitchen ticket, aur paper — ek hi section. Har jagah se yahin aao.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {SUBS.map(({ id, label, hint, Icon }) => {
          const on = sub === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                on
                  ? "border-amber-500/50 bg-amber-500/10 shadow-sm shadow-amber-900/20"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  on ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className={`block text-sm font-medium ${on ? "text-amber-100" : "text-slate-200"}`}>
                  {label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[12rem]">
        {sub === "receipt" ? (
          <BillCustomizationPanel
            branchName={branchName}
            branchCode={branchCode}
            settings={billSettings}
            onChange={setBillSettings}
            onSave={(next) => setBillSettings(next)}
            onNotice={notify}
          />
        ) : null}
        {sub === "kot" ? (
          <KotCustomizationPanel
            branchCode={branchCode}
            branchName={branchName}
            variant={kotVariant}
            onNotice={notify}
          />
        ) : null}
        {sub === "paper" ? (
          <ThermalPrintSettingsPanel branchCode={branchCode} notify={notify} variant="paper" />
        ) : null}
      </div>
    </div>
  );
}
