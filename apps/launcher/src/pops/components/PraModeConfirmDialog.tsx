import { Button } from "@platform/ui";
import { mutedClass, panelClass } from "../lib/themeClasses";

/** Asked when Super Admin enabled both FPRA and Real PRA. */
export function PraModeConfirmDialog({
  open,
  busy,
  onFake,
  onReal,
  onCancel,
}: {
  open: boolean;
  busy?: boolean;
  onFake: () => void;
  onReal: () => void;
  onCancel: () => void;
}): JSX.Element | null {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4">
      <div className={`${panelClass} w-full max-w-md space-y-4 p-5 shadow-xl`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Choose PRA invoice type</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            This business has both <strong>FPRA</strong> and <strong>Real PRA</strong> enabled.
            Which invoice should be generated for this payment?
          </p>
        </div>
        <div className="grid gap-2">
          <Button type="button" disabled={busy} onClick={onFake} className="justify-start">
            FPRA — local fiscal slip + QR (not sent to PRA)
          </Button>
          <Button type="button" disabled={busy} variant="ghost" onClick={onReal} className="justify-start border border-slate-300 dark:border-slate-600">
            Real PRA — submit to PRA e-IMS
          </Button>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
