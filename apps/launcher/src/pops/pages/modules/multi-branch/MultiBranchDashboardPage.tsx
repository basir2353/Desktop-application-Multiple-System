import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPopsBranch, updatePopsBranch } from "../../../api/operations";
import { fetchMultiBranchOverview } from "../../../api/multi-branch";
import { formatPkr, mbInputClass, useMultiBranchAccess } from "../../../hooks/useMultiBranch";
import { useActiveSystemId } from "../../../../hooks/useActiveSystemId";
import { usePopsStore, type PopsBranch } from "../../../../stores/popsStore";
import { erpEntryPathForRole } from "../../../lib/roleAccess";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { MbError, MbLoading } from "./MultiBranchUi";
import { HqUserAccessPanel } from "./HqUserAccessPanel";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function MultiBranchDashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const systemId = useActiveSystemId();
  const { setBranch, branch: openBranch, displayRole } = usePopsStore();
  const { canManage } = useMultiBranchAccess();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", code: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", city: "", code: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["multi-branch", "overview"],
    refetchInterval: 30_000,
    queryFn: fetchMultiBranchOverview,
  });

  const createMutation = useMutation({
    mutationFn: createPopsBranch,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["multi-branch"] });
      void queryClient.invalidateQueries({ queryKey: ["operations", "branches"] });
      setForm({ name: "", city: "", code: "" });
      setShowCreate(false);
      setNotice("Branch created. Chart of accounts initialized.");
      if (created?.id && created.code) {
        setBranch({
          id: created.id,
          code: created.code,
          name: created.name,
          city: created.city,
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name: string; city: string; code: string }) =>
      updatePopsBranch(id, {
        name: input.name.trim(),
        city: input.city.trim(),
        code: input.code.trim() || undefined,
      }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["multi-branch"] });
      void queryClient.invalidateQueries({ queryKey: ["operations", "branches"] });
      if (openBranch?.id === updated.id) {
        setBranch({
          id: updated.id,
          code: updated.code,
          name: updated.name,
          city: updated.city,
        });
      }
      setEditId(null);
      setEditError(null);
      setNotice(`Branch “${updated.name}” updated.`);
    },
    onError: (err) => {
      setEditError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const hasNoBranches =
    overviewQuery.isSuccess && (overviewQuery.data?.branches.length ?? 0) === 0;

  useEffect(() => {
    if (hasNoBranches && canManage) setShowCreate(true);
  }, [hasNoBranches, canManage]);

  if (overviewQuery.isLoading) return <MbLoading />;
  if (overviewQuery.isError) return <MbError message={(overviewQuery.error as Error).message} />;

  const data = overviewQuery.data!;
  const c = data.consolidated;

  function switchToBranch(row: { branchCode: string; branchName: string; city: string; branchId: string }) {
    const b: PopsBranch = {
      id: row.branchId,
      code: row.branchCode,
      name: row.branchName,
      city: row.city,
    };
    setBranch(b);
    navigate(erpEntryPathForRole(systemId, displayRole));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={hasNoBranches ? "Create your first branch" : "Multi-branch control"}
        subtitle={
          hasNoBranches
            ? "Add a branch to unlock POS, inventory, pricing, and the rest of the ERP."
            : "Central monitoring, consolidated reports, transfers, and branch pricing — linked to POS, inventory, and accounting."
        }
        actions={
          <>
            {!hasNoBranches ? (
              <Link
                to="/pops/multi-branch/transfers"
                className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Inter-branch transfer
              </Link>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
              >
                {showCreate ? "Close" : "New branch"}
              </button>
            ) : null}
          </>
        }
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      ) : null}
      {editError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {editError}
        </p>
      ) : null}

      {editId && canManage ? (
        <div className="rounded-lg border border-amber-500/30 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Edit branch</div>
          <p className="mt-1 text-xs text-slate-500">
            Name and city can always change. Code rename is allowed if unused by another branch —
            POS/print settings keyed by the old code stay on that code until reconfigured.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              className={mbInputClass}
              placeholder="Branch name"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className={mbInputClass}
              placeholder="City"
              value={editForm.city}
              onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
            />
            <input
              className={mbInputClass}
              placeholder="Code"
              value={editForm.code}
              onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={updateMutation.isPending || !editForm.name.trim() || !editForm.city.trim()}
              onClick={() =>
                updateMutation.mutate({
                  id: editId,
                  name: editForm.name,
                  city: editForm.city,
                  code: editForm.code,
                })
              }
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setEditError(null);
              }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showCreate && canManage ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Add branch</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input className={mbInputClass} placeholder="Branch name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={mbInputClass} placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <input className={mbInputClass} placeholder="Code (optional)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <button
            type="button"
            disabled={createMutation.isPending || !form.name || !form.city}
            onClick={() => createMutation.mutate({ name: form.name, city: form.city, code: form.code || undefined })}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Create branch
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Branches" value={String(c.branchCount)} />
        <StatCard label="Network sales today" value={formatPkr(c.salesTodayPkr)} />
        <StatCard label="Active orders" value={String(c.activeOrders)} />
        <StatCard label="Inventory alerts" value={String(c.inventoryAlerts)} hint={`${c.pendingTransfers} pending transfers`} />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.branchCode)}
          rows={data.branches as unknown as Record<string, unknown>[]}
          columns={[
            {
              key: "branchCode",
              header: "Branch",
              render: (r) => (
                <div>
                  <div className="font-mono font-medium text-amber-200/90">{String(r.branchCode)}</div>
                  <div className="text-xs text-slate-500">{String(r.branchName)} · {String(r.city)}</div>
                </div>
              ),
            },
            {
              key: "salesTodayPkr",
              header: "Sales today",
              render: (r) => (
                <div>
                  <div>{formatPkr(Number(r.salesTodayPkr))}</div>
                  <div className={`text-xs ${Number(r.salesChangePct) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {Number(r.salesChangePct) >= 0 ? "+" : ""}{Number(r.salesChangePct)}%
                  </div>
                </div>
              ),
            },
            { key: "activeOrders", header: "Orders", render: (r) => String(r.activeOrders) },
            { key: "kitchenQueue", header: "Kitchen", render: (r) => String(r.kitchenQueue) },
            {
              key: "inventoryAlerts",
              header: "Inv. alerts",
              render: (r) => (
                <Badge tone={Number(r.inventoryAlerts) > 2 ? "warning" : "neutral"}>
                  {String(r.inventoryAlerts)}
                </Badge>
              ),
            },
            {
              key: "syncLabel",
              header: "Sync",
              render: (r) => (
                <Badge tone={r.syncStatus === "live" ? "success" : "neutral"}>{String(r.syncLabel)}</Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (r) => (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {canManage ? (
                    <button
                      type="button"
                      className="text-xs text-amber-300 hover:text-amber-200"
                      onClick={() => {
                        setShowCreate(false);
                        setEditError(null);
                        setEditId(String(r.branchId));
                        setEditForm({
                          name: String(r.branchName ?? ""),
                          city: String(r.city ?? ""),
                          code: String(r.branchCode ?? ""),
                        });
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-sky-400 hover:text-sky-300"
                    onClick={() =>
                      switchToBranch({
                        branchId: String(r.branchId),
                        branchCode: String(r.branchCode),
                        branchName: String(r.branchName),
                        city: String(r.city),
                      })
                    }
                  >
                    Open branch
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { to: "/pops/multi-branch/transfers", label: "Transfers" },
          { to: "/pops/multi-branch/pricing", label: "Branch pricing" },
          { to: "/pops/multi-branch/reports", label: "Consolidated report" },
          { to: "/pops/branches", label: "Switch branch" },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2 text-center text-sm text-slate-300 transition hover:border-amber-500/40 hover:text-amber-200"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <HqUserAccessPanel />
    </div>
  );
}
