import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { createPopsBranch, fetchPopsBranches } from "../api/operations";
import { usePopsStore, type PopsBranch, type PopsRole } from "../../stores/popsStore";

const roles: { id: PopsRole; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "manager", label: "Manager" },
  { id: "cashier", label: "Cashier" },
  { id: "waiter", label: "Waiter" },
  { id: "kitchen", label: "Pending orders" },
  { id: "accountant", label: "Accountant" },
  { id: "hr", label: "HR" },
  { id: "rider", label: "Rider" },
];

function toPopsBranch(row: { id: string; code: string; name: string; city: string }): PopsBranch {
  return { id: row.id, code: row.code, name: row.name, city: row.city };
}

export function BranchSelectPage(): JSX.Element {
  const navigate = useNavigate();
  const accessToken = useSessionStore((s) => s.accessToken);
  const persistedBranch = usePopsStore((s) => s.branch);
  const setBranch = usePopsStore((s) => s.setBranch);
  const queryClient = useQueryClient();
  const setDisplayRole = usePopsStore((s) => s.setDisplayRole);
  const setPinSession = usePopsStore((s) => s.setPinSession);
  const displayRole = usePopsStore((s) => s.displayRole);
  const pinSession = usePopsStore((s) => s.pinSession);

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches", accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => fetchPopsBranches(),
  });

  const apiBranches = useMemo(
    () => (branchesQuery.data ?? []).map(toPopsBranch),
    [branchesQuery.data],
  );

  const allBranches = apiBranches;

  const [selected, setSelected] = useState<PopsBranch | null>(allBranches[0] ?? null);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newCode, setNewCode] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (persistedBranch?.id.startsWith("custom-")) {
      setBranch(null);
    }
  }, [persistedBranch?.id, setBranch]);

  useEffect(() => {
    if (selected && !allBranches.some((b) => b.id === selected.id)) {
      setSelected(allBranches[0] ?? null);
    }
  }, [allBranches, selected]);

  const createBranchMutation = useMutation({
    mutationFn: () =>
      createPopsBranch({
        name: newName.trim(),
        city: newCity.trim(),
        code: newCode.trim() || undefined,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["operations", "branches"] });
      setSelected(toPopsBranch(created));
      setNewName("");
      setNewCity("");
      setNewCode("");
      setAddError(null);
    },
    onError: (err: Error) => setAddError(err.message),
  });

  function onAddBranch(e: React.FormEvent): void {
    e.preventDefault();
    setAddError(null);
    if (!newName.trim()) {
      setAddError("Enter a branch name.");
      return;
    }
    if (!newCity.trim()) {
      setAddError("Enter a city.");
      return;
    }
    createBranchMutation.mutate();
  }

  function continueToDashboard(): void {
    if (selected) setBranch(selected);
    navigate("/pops/dashboard", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">POPS</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Restaurant ERP</h1>
          <p className="mt-2 text-sm text-slate-400">Choose a branch to load permissions, pricing, and inventory scope.</p>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Branch</h2>
              {branchesQuery.isLoading ? (
                <p className="mt-3 text-xs text-slate-500">Loading branches from control plane…</p>
              ) : null}
              {branchesQuery.isError ? (
                <p className="mt-3 text-xs text-red-400/90">
                  Could not load branches from the control plane. {(branchesQuery.error as Error).message}
                </p>
              ) : null}
              {!branchesQuery.isLoading && !branchesQuery.isError && apiBranches.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No branches in your organization yet. Add one below or run the API seed (`pnpm dev:api` after `pnpm
                  db:push`).
                </p>
              ) : null}
              <div className="mt-4 space-y-2">
                {allBranches.map((b) => (
                  <label
                    key={b.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-3 text-sm transition ${
                      selected?.id === b.id
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium text-slate-100">{b.name}</span>
                      <span className="text-xs text-slate-500">
                        {b.city} · {b.code}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <input
                        type="radio"
                        name="branch"
                        className="accent-amber-500"
                        checked={selected?.id === b.id}
                        onChange={() => setSelected(b)}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Add branch</h2>
              <p className="mt-1 text-xs text-slate-500">
                Branches load from your organization when the API is available; custom entries stay on this device until
                synced.
              </p>
              <form className="mt-4 space-y-3" onSubmit={onAddBranch}>
                <label className="block text-xs text-slate-400">
                  Branch name
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. POPS F-7"
                    autoComplete="organization"
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  City
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g. Islamabad"
                    autoComplete="address-level2"
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Branch code{" "}
                  <span className="font-normal text-slate-600">(optional — letters, numbers, dashes)</span>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. ISB-F7"
                  />
                </label>
                {addError ? <p className="text-xs text-red-400">{addError}</p> : null}
                <Button type="submit" className="w-full" disabled={createBranchMutation.isPending}>
                  {createBranchMutation.isPending ? "Adding…" : "Add branch"}
                </Button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Workspace role</h2>
              <p className="mt-1 text-xs text-slate-500">JWT permissions apply for API calls; this labels the ERP workspace.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setDisplayRole(r.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      displayRole === r.id
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="accent-amber-500"
                  checked={pinSession}
                  onChange={(e) => setPinSession(e.target.checked)}
                />
                PIN-based session (shorter re-auth prompts)
              </label>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
              After you continue, your role and branch scope drive which menus and actions appear in the ERP shell.
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button onClick={continueToDashboard} disabled={!selected}>
            Open dashboard
          </Button>
          <Button variant="ghost" onClick={() => navigate("/", { replace: true })}>
            Platform shell
          </Button>
        </div>
      </div>
    </div>
  );
}
