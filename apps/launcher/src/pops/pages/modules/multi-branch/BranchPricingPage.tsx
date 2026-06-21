import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPopsBranches } from "../../../api/operations";
import { copyBranchPricing, fetchBranchPricing, setBranchPriceOverride } from "../../../api/multi-branch";
import { formatPkr, mbInputClass, useMultiBranchAccess } from "../../../hooks/useMultiBranch";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { MbError, MbLoading } from "./MultiBranchUi";

export function BranchPricingPage(): JSX.Element {
  const { canManage } = useMultiBranchAccess();
  const queryClient = useQueryClient();
  const [branchCode, setBranchCode] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches"],
    queryFn: fetchPopsBranches,
  });

  const pricingQuery = useQuery({
    queryKey: ["multi-branch", "pricing", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchPricing(branchCode),
  });

  const setPriceMutation = useMutation({
    mutationFn: setBranchPriceOverride,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["multi-branch", "pricing"] }),
  });

  const copyMutation = useMutation({
    mutationFn: copyBranchPricing,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["multi-branch", "pricing"] }),
  });

  if (branchesQuery.isLoading) return <MbLoading />;
  const branches = branchesQuery.data ?? [];
  const rows = (pricingQuery.data?.rows ?? []) as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Branch pricing"
        subtitle="Set branch-specific menu prices. Updates sync to POS menu for that branch."
        actions={
          <Link to="/pops/multi-branch" className="text-xs text-slate-400 hover:text-white">
            ← Overview
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <select className={mbInputClass} value={branchCode} onChange={(e) => setBranchCode(e.target.value)}>
          <option value="">Select branch</option>
          {branches.map((b) => (
            <option key={b.id} value={b.code}>{b.code} — {b.name}</option>
          ))}
        </select>
      </div>

      {canManage ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Copy prices between branches</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <select className={mbInputClass} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Copy from</option>
              {branches.map((b) => <option key={b.id} value={b.code}>{b.code}</option>)}
            </select>
            <select className={mbInputClass} value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>
              <option value="">Copy to</option>
              {branches.filter((b) => b.code !== copyFrom).map((b) => <option key={b.id} value={b.code}>{b.code}</option>)}
            </select>
            <button
              type="button"
              disabled={copyMutation.isPending || !copyFrom || !copyTo}
              onClick={() => copyMutation.mutate({ fromBranchCode: copyFrom, toBranchCode: copyTo })}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Copy matching items
            </button>
          </div>
        </div>
      ) : null}

      {pricingQuery.isLoading && branchCode ? <MbLoading /> : null}
      {pricingQuery.isError ? <MbError message={(pricingQuery.error as Error).message} /> : null}

      {branchCode && rows.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
          <SimpleTable
            rowKey={(r) => String(r.menuItemId)}
            rows={rows}
            columns={[
              { key: "itemName", header: "Item" },
              { key: "categoryName", header: "Category" },
              { key: "basePricePkr", header: "Base", render: (r) => formatPkr(Number(r.basePricePkr)) },
              {
                key: "effectivePricePkr",
                header: "Price (PKR)",
                render: (r) =>
                  canManage ? (
                    <input
                      type="number"
                      min={0}
                      className={`${mbInputClass} w-28`}
                      defaultValue={Number(r.effectivePricePkr)}
                      onBlur={(e) => {
                        const price = Number(e.target.value);
                        if (Number.isNaN(price) || price === Number(r.effectivePricePkr)) return;
                        setPriceMutation.mutate({
                          branchCode,
                          menuItemId: String(r.menuItemId),
                          pricePkr: price,
                        });
                      }}
                    />
                  ) : (
                    formatPkr(Number(r.effectivePricePkr))
                  ),
              },
            ]}
          />
        </div>
      ) : branchCode ? (
        <p className="text-sm text-slate-500">No menu items for this branch. Add items under Menu first.</p>
      ) : (
        <p className="text-sm text-slate-500">Select a branch to view and edit prices.</p>
      )}
    </div>
  );
}
