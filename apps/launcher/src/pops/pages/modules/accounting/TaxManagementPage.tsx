import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTaxSettings, updateTaxSettings } from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { AccountingError, AccountingFormPanel, AccountingLoading, StatCard } from "./AccountingUi";

export function TaxManagementPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [salesTaxPct, setSalesTaxPct] = useState("");
  const [serviceTaxPct, setServiceTaxPct] = useState("");
  const [taxRegNo, setTaxRegNo] = useState("");

  const taxQuery = useQuery({
    queryKey: ["accounting", "tax", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTaxSettings(branch!.code),
  });

  const updateMutation = useMutation({
    mutationFn: updateTaxSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounting"] }),
  });

  if (taxQuery.isLoading) return <AccountingLoading />;
  if (taxQuery.isError) return <AccountingError message={(taxQuery.error as Error).message} />;

  const t = taxQuery.data!;

  return (
    <div className="space-y-4">
      <PageHeader title="Tax management" subtitle="GST/VAT configuration, tax collected, and tax paid." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tax name" value={t.taxName} />
        <StatCard label="Sales tax %" value={`${t.salesTaxPct}%`} />
        <StatCard label="Service tax %" value={`${t.serviceTaxPct}%`} />
        <StatCard label="Tax collected (month)" value={formatPkr(t.taxCollected)} />
        <StatCard label="Tax paid (month)" value={formatPkr(t.taxPaid)} />
      </div>

      {canManage ? (
        <AccountingFormPanel
          title="Tax configuration"
          submitLabel="Save settings"
          disabled={updateMutation.isPending}
          onSubmit={() => {
            if (!branch?.code) return;
            updateMutation.mutate({
              branchCode: branch.code,
              salesTaxPct: salesTaxPct ? Number(salesTaxPct) : undefined,
              serviceTaxPct: serviceTaxPct ? Number(serviceTaxPct) : undefined,
              taxRegistrationNo: taxRegNo || undefined,
            });
          }}
        >
          <input className={accountingInputClass} placeholder={`Sales tax % (current: ${t.salesTaxPct})`} type="number" value={salesTaxPct} onChange={(e) => setSalesTaxPct(e.target.value)} />
          <input className={accountingInputClass} placeholder={`Service tax % (current: ${t.serviceTaxPct})`} type="number" value={serviceTaxPct} onChange={(e) => setServiceTaxPct(e.target.value)} />
          <input className={accountingInputClass} placeholder={`Registration no. (current: ${t.taxRegistrationNo ?? "—"})`} value={taxRegNo} onChange={(e) => setTaxRegNo(e.target.value)} />
        </AccountingFormPanel>
      ) : null}
    </div>
  );
}
