import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchRiders } from "../api/delivery";
import { fetchWaiters } from "../api/billing";
import {
  emitPosShiftTeamChanged,
  loadPosShiftTeam,
  savePosShiftTeam,
  type PosShiftTeam,
} from "../lib/posShiftTeam";
import { fieldInputClass, modalBackdropRaisedClass } from "../lib/themeClasses";
import { usePopsStore } from "../../stores/popsStore";

type Props = {
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

export function PosTeamChangeModal({ onClose, onSuccess }: Props): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const initial = useMemo(() => loadPosShiftTeam(branch?.code), [branch?.code]);
  const [waiterId, setWaiterId] = useState(initial.waiterId);
  const [riderId, setRiderId] = useState(initial.riderId);

  const waitersQuery = useQuery({
    queryKey: ["billing", "waiters", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchWaiters(branch!.code),
  });
  const ridersQuery = useQuery({
    queryKey: ["operations", "riders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchRiders(branch!.code),
  });

  const waiters = waitersQuery.data ?? [];
  const riders = (ridersQuery.data ?? []).filter((r) => r.active !== false);

  const save = useMutation({
    mutationFn: async () => {
      if (!branch?.code) throw new Error("Select a branch first.");
      const waiter = waiters.find((w) => w.id === waiterId);
      const rider = riders.find((r) => r.id === riderId);
      const team: PosShiftTeam = {
        waiterId: waiter?.id ?? "",
        waiterName: waiter?.name?.trim() || "",
        riderId: rider?.id ?? "",
        riderName: rider?.name?.trim() || "",
      };
      savePosShiftTeam(branch.code, team);
      emitPosShiftTeamChanged(branch.code);
      return team;
    },
    onSuccess: (team) => {
      const parts = [
        team.waiterName ? `Waiter: ${team.waiterName}` : null,
        team.riderName ? `Rider: ${team.riderName}` : null,
      ].filter(Boolean);
      onSuccess?.(parts.length ? `Team set — ${parts.join(" · ")}` : "Team cleared.");
      onClose();
    },
  });

  return (
    <div className={modalBackdropRaisedClass} role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Team / AP change</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Shift waiter / rider select karein — bills aur reports isi naam pe alag aayengi.
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

        <div className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase text-slate-500">Waiters team</span>
            <select
              className={fieldInputClass}
              value={waiterId}
              onChange={(e) => setWaiterId(e.target.value)}
            >
              <option value="">— Session user / no assigned waiter —</option>
              {waiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase text-slate-500">Riders team</span>
            <select
              className={fieldInputClass}
              value={riderId}
              onChange={(e) => setRiderId(e.target.value)}
            >
              <option value="">— No default rider —</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              Delivery order pe default rider yahan se auto select hoga (override possible).
            </p>
          </label>

          {save.isError ? (
            <p className="text-xs text-rose-600 dark:text-rose-300">
              {(save.error as Error).message}
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
              type="button"
              disabled={save.isPending || !branch?.code}
              onClick={() => save.mutate()}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Apply team"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
