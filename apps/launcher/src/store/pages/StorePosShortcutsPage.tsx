import { useEffect, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";
import { useStoreAccess } from "../hooks/useStore";
import {
  DEFAULT_STORE_POS_ACTION_MAP,
  STORE_POS_ACTIONS,
  STORE_POS_HOTKEYS,
  actionLabel,
  loadStorePosActionMap,
  saveStorePosActionMap,
  type StorePosActionId,
  type StorePosActionMap,
  type StorePosHotkey,
} from "../lib/storePosActionShortcuts";
import { StoreSelect } from "../ui/StoreUi";
import { Link } from "react-router-dom";

export function StoreShortcutsPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const [map, setMap] = useState<StorePosActionMap>(() => loadStorePosActionMap(undefined));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMap(loadStorePosActionMap(branch?.code));
    setSaved(false);
  }, [branch?.code]);

  function setKey(hotkey: StorePosHotkey, action: StorePosActionId): void {
    setMap((prev) => {
      const next = { ...prev, [hotkey]: action };
      saveStorePosActionMap(next, branch?.code);
      return next;
    });
    setSaved(true);
  }

  function resetDefaults(): void {
    const next = { ...DEFAULT_STORE_POS_ACTION_MAP };
    saveStorePosActionMap(next, branch?.code);
    setMap(next);
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="POS shortcuts"
        subtitle="Assign F1–F12 to POS screen actions (search, pay, hold, etc.). These are not product shortcuts — pressing a key jumps to that action on Point of sale."
      />

      {saved ? (
        <div className={noticeSuccessClass}>Shortcuts saved for this branch. Open POS and press the key to try.</div>
      ) : null}

      <section className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-4 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
        <p className="font-semibold">How it works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-sky-800 dark:text-sky-200/90">
          <li>
            Example: set <kbd className="rounded bg-white/80 px-1 dark:bg-slate-900">F1</kbd> → Go to search bar —
            press F1 on POS and the cursor moves to search.
          </li>
          <li>
            Example: set <kbd className="rounded bg-white/80 px-1 dark:bg-slate-900">F10</kbd> → Pay — opens payment
            when the cart has items.
          </li>
          <li>
            Manage any key up to F12 below. Changes apply immediately on{" "}
            <Link to="/pops/store/pos" className="font-semibold underline underline-offset-2">
              Point of sale
            </Link>
            .
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Branch: <span className="font-semibold text-slate-700 dark:text-slate-200">{branch?.name ?? "—"}</span>
        </p>
        <button
          type="button"
          onClick={resetDefaults}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Reset to defaults
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-900/80">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Key</th>
              <th className="px-3 py-2.5 font-semibold">Action on POS</th>
              <th className="hidden px-3 py-2.5 font-semibold md:table-cell">Hint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950/40">
            {STORE_POS_HOTKEYS.map((hotkey) => {
              const action = map[hotkey];
              const def = STORE_POS_ACTIONS.find((a) => a.id === action);
              return (
                <tr key={hotkey} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                  <td className="px-3 py-2.5">
                    <kbd className="inline-flex min-w-[2.5rem] justify-center rounded-md bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-white dark:bg-slate-700">
                      {hotkey}
                    </kbd>
                  </td>
                  <td className="px-3 py-2.5">
                    <StoreSelect
                      value={action}
                      onChange={(e) => setKey(hotkey, e.target.value as StorePosActionId)}
                      className="max-w-xs"
                    >
                      {STORE_POS_ACTIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </StoreSelect>
                    <p className="mt-1 text-[11px] text-slate-400 md:hidden">{def?.hint}</p>
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-slate-500 md:table-cell">{def?.hint}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current map</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STORE_POS_HOTKEYS.map((hotkey) => (
            <span
              key={hotkey}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-950"
            >
              <span className="font-bold text-slate-800 dark:text-slate-100">{hotkey}</span>
              <span className="text-slate-400">→</span>
              <span className="text-slate-600 dark:text-slate-300">{actionLabel(map[hotkey])}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
