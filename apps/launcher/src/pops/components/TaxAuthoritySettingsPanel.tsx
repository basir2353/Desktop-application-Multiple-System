import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { updateTaxFeaturesNormalized } from "../../lib/praApi";
import {
  isPraFakeEnabled,
  isPraRealEnabled,
  useTaxAuthorityFeatures,
} from "../hooks/useTaxAuthorityFeatures";
import { mutedClass, panelClass } from "../lib/themeClasses";

/**
 * Org Admin / Accountant: activate FBR, Fake PRA, or Real PRA.
 * Fake and Real are mutually exclusive.
 */
export function TaxAuthoritySettingsPanel({
  onNotice,
  onError,
}: {
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
}): JSX.Element {
  const qc = useQueryClient();
  const taxFeatures = useTaxAuthorityFeatures();
  const fbrEnabled = Boolean(taxFeatures.data?.fbrEnabled);
  const praFakeEnabled = isPraFakeEnabled(taxFeatures.data);
  const praRealEnabled = isPraRealEnabled(taxFeatures.data);

  const saveMut = useMutation({
    mutationFn: (patch: {
      fbrEnabled?: boolean;
      praFakeEnabled?: boolean;
      praRealEnabled?: boolean;
    }) => updateTaxFeaturesNormalized(patch),
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
      const mode = saved.praRealEnabled
        ? "Real PRA ON"
        : saved.praFakeEnabled
          ? "Fake PRA ON"
          : "PRA off";
      onNotice?.(
        `Saved — FBR ${saved.fbrEnabled ? "ON" : "OFF"} · ${mode}. New sales use the active PRA mode.`,
      );
    },
    onError: (err) => {
      onError?.(err instanceof Error ? err.message : "Could not save FBR / PRA settings.");
    },
  });

  function setFbr(checked: boolean): void {
    saveMut.mutate({ fbrEnabled: checked });
  }

  function setFakePra(checked: boolean): void {
    // Mutual exclusive: enabling Fake clears Real.
    saveMut.mutate(
      checked
        ? { praFakeEnabled: true, praRealEnabled: false }
        : { praFakeEnabled: false },
    );
  }

  function setRealPra(checked: boolean): void {
    // Mutual exclusive: enabling Real clears Fake.
    saveMut.mutate(
      checked
        ? { praRealEnabled: true, praFakeEnabled: false }
        : { praRealEnabled: false },
    );
  }

  return (
    <div className={`max-w-xl space-y-3 ${panelClass} p-4`}>
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          FBR &amp; PRA integration
        </div>
        <p className={`mt-1 text-xs ${mutedClass}`}>
          Super Admin unlocked tax for this business. You can switch FBR / Fake PRA / Real PRA
          here. Only one PRA mode can be active. After Real PRA is ON, connect credentials under
          Tax → Real PRA Integration.
        </p>
      </div>

      {taxFeatures.isLoading ? (
        <p className={`text-sm ${mutedClass}`}>Loading tax features…</p>
      ) : null}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            className="accent-sky-600"
            checked={fbrEnabled}
            disabled={saveMut.isPending || taxFeatures.isLoading}
            onChange={(e) => setFbr(e.target.checked)}
          />
          <span className="font-medium">FBR</span>
          <span className={`text-xs ${mutedClass}`}>Federal tax invoices</span>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={praFakeEnabled}
            disabled={saveMut.isPending || taxFeatures.isLoading}
            onChange={(e) => setFakePra(e.target.checked)}
          />
          <span className="font-medium">Fake PRA</span>
          <span className={`text-xs ${mutedClass}`}>
            Local fiscal Invoice # + QR (no PRA login)
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            className="accent-emerald-600"
            checked={praRealEnabled}
            disabled={saveMut.isPending || taxFeatures.isLoading}
            onChange={(e) => setRealPra(e.target.checked)}
          />
          <span className="font-medium">Real PRA</span>
          <span className={`text-xs ${mutedClass}`}>
            Upload to PRA when connected
          </span>
        </label>
      </div>

      <p className={`text-xs ${mutedClass}`}>
        Active now:{" "}
        <strong className="text-slate-800 dark:text-slate-100">
          {praRealEnabled ? "Real PRA" : praFakeEnabled ? "Fake PRA" : "None"}
        </strong>
        {fbrEnabled ? " · FBR ON" : " · FBR OFF"}
        {saveMut.isPending ? " · Saving…" : ""}
      </p>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/pops/tax"
          className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
        >
          Open Tax / connect PRA
        </Link>
        {praRealEnabled ? (
          <Link
            to="/pops/tax/pra-real"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Connect Real PRA
          </Link>
        ) : null}
      </div>
    </div>
  );
}
