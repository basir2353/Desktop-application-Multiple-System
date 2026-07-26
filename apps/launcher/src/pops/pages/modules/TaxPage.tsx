import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  connectFbr,
  connectPra,
  fetchTaxAuthorityStatus,
  fetchTaxInvoices,
  refreshFbrToken,
  refreshPraToken,
} from "../../../lib/taxAuthorityApi";
import { usePopsStore } from "../../../stores/popsStore";
import { fieldInputClass, fieldSelectClass, mutedClass, panelClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";

type CompanyForm = {
  companyName: string;
  ntn: string;
  strn: string;
  businessType: string;
  province: string;
  branchName: string;
  branchCode: string;
};

type FbrForm = {
  clientId: string;
  clientSecret: string;
  posId: string;
  terminalId: string;
  environment: "sandbox" | "production";
};

type PraForm = {
  registrationNumber: string;
  username: string;
  password: string;
  praBranchCode: string;
  environment: "sandbox" | "production";
};

const emptyCompany = (branchName = "", branchCode = ""): CompanyForm => ({
  companyName: "",
  ntn: "",
  strn: "",
  businessType: "",
  province: "",
  branchName,
  branchCode,
});

const emptyFbr = (): FbrForm => ({
  clientId: "",
  clientSecret: "",
  posId: "",
  terminalId: "",
  environment: "sandbox",
});

const emptyPra = (branchCode = ""): PraForm => ({
  registrationNumber: "",
  username: "",
  password: "",
  praBranchCode: branchCode,
  environment: "sandbox",
});

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected" || status === "verified" || status === "submitted") return "success";
  if (status === "queued" || status === "submitting" || status === "expired") return "warning";
  if (status === "failed" || status === "error") return "danger";
  return "neutral";
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function TaxPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const qc = useQueryClient();
  const branchCode = branch?.code ?? "";

  const [company, setCompany] = useState<CompanyForm>(emptyCompany());
  const [fbr, setFbr] = useState<FbrForm>(emptyFbr());
  const [pra, setPra] = useState<PraForm>(emptyPra());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["tax-authority", "status", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchTaxAuthorityStatus(branchCode),
  });

  const invoicesQuery = useQuery({
    queryKey: ["tax-authority", "invoices", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchTaxInvoices(branchCode),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!branch) return;
    setCompany((prev) => ({
      ...prev,
      branchName: prev.branchName || branch.name,
      branchCode: prev.branchCode || branch.code,
    }));
    setPra((prev) => ({
      ...prev,
      praBranchCode: prev.praBranchCode || branch.code,
    }));
  }, [branch]);

  useEffect(() => {
    const data = statusQuery.data;
    if (!data) return;
    setCompany({
      companyName: data.company.companyName ?? "",
      ntn: data.company.ntn ?? "",
      strn: data.company.strn ?? "",
      businessType: data.company.businessType ?? "",
      province: data.company.province ?? "",
      branchName: data.company.branchName || branch?.name || "",
      branchCode: data.company.branchCode || branch?.code || "",
    });
    setFbr((prev) => ({
      clientId: data.fbr.clientId ?? "",
      clientSecret: "",
      posId: data.fbr.posId ?? "",
      terminalId: data.fbr.terminalId ?? "",
      environment: data.fbr.environment,
      // Keep blank secret unless user retypes; show masked hint via placeholder
      ...(prev.clientSecret ? { clientSecret: prev.clientSecret } : {}),
    }));
    setPra((prev) => ({
      registrationNumber: data.pra.registrationNumber ?? "",
      username: data.pra.username ?? "",
      password: prev.password || "",
      praBranchCode: data.pra.praBranchCode || branch?.code || "",
      environment: data.pra.environment,
    }));
  }, [statusQuery.data, branch?.name, branch?.code]);

  const connectFbrMut = useMutation({
    mutationFn: () => {
      if (!branchCode) throw new Error("Select a branch first.");
      return connectFbr({
        branchCode,
        company,
        clientId: fbr.clientId,
        clientSecret: fbr.clientSecret,
        posId: fbr.posId,
        terminalId: fbr.terminalId,
        environment: fbr.environment,
      });
    },
    onSuccess: async (res) => {
      setError(null);
      setMessage(res.message);
      setFbr((prev) => ({ ...prev, clientSecret: "" }));
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Connect failed");
    },
  });

  // If user left secret blank but we already have one saved, refresh instead of connect with placeholder.
  const connectFbrSmart = () => {
    setError(null);
    setMessage(null);
    if (!company.companyName || !company.ntn || !company.strn || !company.businessType || !company.province || !company.branchCode || !fbr.posId || !fbr.terminalId) {
      setError("Please complete all required fields.");
      return;
    }
    if (!fbr.clientSecret.trim()) {
      if (statusQuery.data?.fbr.clientSecretMasked) {
        refreshFbrMut.mutate();
        return;
      }
      setError("Please complete all required fields.");
      return;
    }
    connectFbrMut.mutate();
  };

  const connectPraMut = useMutation({
    mutationFn: () => {
      if (!branchCode) throw new Error("Select a branch first.");
      return connectPra({
        branchCode,
        company,
        registrationNumber: pra.registrationNumber,
        username: pra.username,
        password: pra.password,
        praBranchCode: pra.praBranchCode,
        environment: pra.environment,
      });
    },
    onSuccess: async (res) => {
      setError(null);
      setMessage(res.message);
      setPra((prev) => ({ ...prev, password: "" }));
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Connect failed");
    },
  });

  const connectPraSmart = () => {
    setError(null);
    setMessage(null);
    if (
      !company.companyName ||
      !company.ntn ||
      !company.strn ||
      !company.businessType ||
      !company.province ||
      !company.branchCode ||
      !pra.registrationNumber ||
      !pra.praBranchCode
    ) {
      setError("Please complete all required fields.");
      return;
    }
    if (!pra.password.trim()) {
      if (statusQuery.data?.pra.passwordMasked) {
        refreshPraMut.mutate();
        return;
      }
      setError("Please complete all required fields.");
      return;
    }
    connectPraMut.mutate();
  };

  const refreshFbrMut = useMutation({
    mutationFn: () => refreshFbrToken(branchCode),
    onSuccess: async (res) => {
      setError(null);
      setMessage(res.message);
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Refresh failed");
    },
  });

  const refreshPraMut = useMutation({
    mutationFn: () => refreshPraToken(branchCode),
    onSuccess: async (res) => {
      setError(null);
      setMessage(res.message);
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Refresh failed");
    },
  });

  if (!branch?.code) {
    return <PageHeader title="FBR & PRA Integration" subtitle="Select a branch to configure tax authority connections." />;
  }

  const fbrStatus = statusQuery.data?.fbr.status ?? "disconnected";
  const praStatus = statusQuery.data?.pra.status ?? "disconnected";
  const invoices = invoicesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="FBR & PRA Integration"
        subtitle={`Connect ${branch.name} (${branch.code}) once — invoices submit automatically after sales.`}
      />

      <div className={`grid gap-3 sm:grid-cols-2 ${panelClass} p-4`}>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">FBR status</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={statusTone(fbrStatus)}>{fbrStatus === "connected" ? "Connected" : fbrStatus}</Badge>
            <span className={`text-sm ${mutedClass}`}>
              Last: {formatWhen(statusQuery.data?.fbr.connectedAt)}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">PRA status</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={statusTone(praStatus)}>{praStatus === "connected" ? "Connected" : praStatus}</Badge>
            <span className={`text-sm ${mutedClass}`}>
              Last: {formatWhen(statusQuery.data?.pra.connectedAt)}
            </span>
          </div>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <section className={`${panelClass} space-y-4 p-4`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Company Information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["companyName", "Company Name"],
              ["ntn", "NTN"],
              ["strn", "STRN"],
              ["businessType", "Business Type"],
              ["province", "Province"],
              ["branchName", "Branch Name"],
              ["branchCode", "Branch Code"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
              <input
                className={fieldInputClass}
                value={company[key]}
                onChange={(e) => setCompany((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </section>

      <section className={`${panelClass} space-y-4 p-4`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">FBR Settings</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Client ID</span>
            <input
              className={fieldInputClass}
              value={fbr.clientId}
              onChange={(e) => setFbr((prev) => ({ ...prev, clientId: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Client Secret / Security Token</span>
            <input
              type="password"
              className={fieldInputClass}
              placeholder={statusQuery.data?.fbr.clientSecretMasked ?? "••••••••"}
              value={fbr.clientSecret}
              onChange={(e) => setFbr((prev) => ({ ...prev, clientSecret: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">POS ID</span>
            <input
              className={fieldInputClass}
              value={fbr.posId}
              onChange={(e) => setFbr((prev) => ({ ...prev, posId: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Terminal ID</span>
            <input
              className={fieldInputClass}
              value={fbr.terminalId}
              onChange={(e) => setFbr((prev) => ({ ...prev, terminalId: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">API Environment</span>
            <select
              className={fieldSelectClass}
              value={fbr.environment}
              onChange={(e) =>
                setFbr((prev) => ({
                  ...prev,
                  environment: e.target.value === "production" ? "production" : "sandbox",
                }))
              }
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={connectFbrMut.isPending || refreshFbrMut.isPending}
            onClick={connectFbrSmart}
          >
            {connectFbrMut.isPending || refreshFbrMut.isPending ? "Connecting…" : "Connect FBR"}
          </Button>
        </div>
      </section>

      <section className={`${panelClass} space-y-4 p-4`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">PRA Settings</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Registration Number</span>
            <input
              className={fieldInputClass}
              value={pra.registrationNumber}
              onChange={(e) => setPra((prev) => ({ ...prev, registrationNumber: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Username</span>
            <input
              className={fieldInputClass}
              value={pra.username}
              onChange={(e) => setPra((prev) => ({ ...prev, username: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Password / API Key</span>
            <input
              type="password"
              className={fieldInputClass}
              placeholder={statusQuery.data?.pra.passwordMasked ?? "••••••••"}
              value={pra.password}
              onChange={(e) => setPra((prev) => ({ ...prev, password: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Branch Code</span>
            <input
              className={fieldInputClass}
              value={pra.praBranchCode}
              onChange={(e) => setPra((prev) => ({ ...prev, praBranchCode: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600 dark:text-slate-300">Environment</span>
            <select
              className={fieldSelectClass}
              value={pra.environment}
              onChange={(e) =>
                setPra((prev) => ({
                  ...prev,
                  environment: e.target.value === "production" ? "production" : "sandbox",
                }))
              }
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={connectPraMut.isPending || refreshPraMut.isPending}
            onClick={connectPraSmart}
          >
            {connectPraMut.isPending || refreshPraMut.isPending ? "Connecting…" : "Connect PRA"}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <PageHeader title="Invoice queue" subtitle="Submitted and pending FBR / PRA invoices for this branch." />
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "sourceRef", header: "Invoice" },
            {
              key: "authority",
              header: "Authority",
              render: (r) => String(r.authority).toUpperCase(),
            },
            {
              key: "taxableAmountPkr",
              header: "Taxable (Rs)",
              render: (r) => Number(r.taxableAmountPkr).toLocaleString(),
            },
            {
              key: "taxAmountPkr",
              header: "Tax (Rs)",
              render: (r) => Number(r.taxAmountPkr).toLocaleString(),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <Badge tone={statusTone(String(r.status))}>{String(r.status)}</Badge>,
            },
            {
              key: "authorityInvoiceNumber",
              header: "Reference / QR",
              render: (r) => String(r.authorityInvoiceNumber ?? r.qrPayload ?? "—"),
            },
          ]}
          rows={invoices as unknown as Record<string, unknown>[]}
        />
        {invoicesQuery.isLoading ? <p className={`text-sm ${mutedClass}`}>Loading invoices…</p> : null}
        {!invoicesQuery.isLoading && invoices.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>No tax invoices yet. Complete a sale after connecting.</p>
        ) : null}
      </section>
    </div>
  );
}
