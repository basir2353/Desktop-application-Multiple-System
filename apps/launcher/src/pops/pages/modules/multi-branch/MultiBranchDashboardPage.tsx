import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createPopsBranch } from "../../../api/operations";
import { fetchMultiBranchOverview } from "../../../api/multi-branch";
import { formatPkr, mbInputClass, useMultiBranchAccess } from "../../../hooks/useMultiBranch";
import { usePopsStore, type PopsBranch } from "../../../../stores/popsStore";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { MbError, MbLoading } from "./MultiBranchUi";

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
  const { setBranch } = usePopsStore();
  const { canManage } = useMultiBranchAccess();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", code: "" });
  const [notice, setNotice] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["multi-branch", "overview"],
    refetchInterval: 30_000,
    queryFn: fetchMultiBranchOverview,
  });

  const createMutation = useMutation({
    mutationFn: createPopsBranch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["multi-branch"] });
      void queryClient.invalidateQueries({ queryKey: ["operations", "branches"] });
      setForm({ name: "", city: "", code: "" });
      setShowCreate(false);
      setNotice("Branch created. Chart of accounts initialized.");
    },
  });

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
    navigate("/pops/dashboard");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Multi-branch control"
        subtitle="Central monitoring, consolidated reports, transfers, and branch pricing — linked to POS, inventory, and accounting."
        actions={
          <>
            <Link
              to="/pops/multi-branch/transfers"
              className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
            >
              Inter-branch transfer
            </Link>
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
    </div>
  );
}
