import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  connectFbr,
  connectPra,
  fetchTaxAuthorityStatus,
  fetchTaxInvoices,
  refreshFbrToken,
  refreshPraToken,
} from "../../../lib/taxAuthorityApi";
import { useActiveSystemId } from "../../../hooks/useActiveSystemId";
import { usePopsStore } from "../../../stores/popsStore";
import { isTaxAuthorityEnabled, useTaxAuthorityFeatures } from "../../hooks/useTaxAuthorityFeatures";
import { erpEntryPathForRole } from "../../lib/roleAccess";
import { fieldInputClass, fieldSelectClass, mutedClass, panelClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";

/** Org-level attachment when the business has no store branch selected. */
const MAIN_SYSTEM_BRANCH_CODE = "MAIN";
const MAIN_SYSTEM_BRANCH_NAME = "Main System";

type TaxSection = "overview" | "fbr" | "pra" | "invoices";

function taxSectionFromPath(pathname: string): TaxSection {
  if (pathname.endsWith("/tax/fbr")) return "fbr";
  if (pathname.endsWith("/tax/pra")) return "pra";
  if (pathname.endsWith("/tax/invoices")) return "invoices";
  return "overview";
}

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
  const displayRole = usePopsStore((s) => s.displayRole);
  const systemId = useActiveSystemId();
  const { pathname } = useLocation();
  const section = useMemo(() => taxSectionFromPath(pathname), [pathname]);
  const qc = useQueryClient();
  const branchCode = branch?.code || MAIN_SYSTEM_BRANCH_CODE;
  const branchLabel = branch?.name || MAIN_SYSTEM_BRANCH_NAME;
  const isStore = systemId === "general-store";
  /** Keep Tax page reachable from sidebar even before Super Admin enables FBR/PRA. */
  const alwaysShowTaxPage = isStore || systemId === "restaurant";
  const taxFeatures = useTaxAuthorityFeatures();
  const taxEnabled = alwaysShowTaxPage || isTaxAuthorityEnabled(taxFeatures.data);
  const onMainSystem = !branch?.code;

  const [company, setCompany] = useState<CompanyForm>(
    emptyCompany(MAIN_SYSTEM_BRANCH_NAME, MAIN_SYSTEM_BRANCH_CODE),
  );
  const [fbr, setFbr] = useState<FbrForm>(emptyFbr());
  const [pra, setPra] = useState<PraForm>(emptyPra(MAIN_SYSTEM_BRANCH_CODE));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["tax-authority", "status", branchCode],
    enabled: taxEnabled || alwaysShowTaxPage,
    queryFn: () => fetchTaxAuthorityStatus(branchCode),
  });

  const invoicesQuery = useQuery({
    queryKey: ["tax-authority", "invoices", branchCode],
    enabled: isTaxAuthorityEnabled(taxFeatures.data),
    queryFn: () => fetchTaxInvoices(branchCode),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const name = branch?.name || MAIN_SYSTEM_BRANCH_NAME;
    const code = branch?.code || MAIN_SYSTEM_BRANCH_CODE;
    setCompany((prev) => ({
      ...prev,
      branchName: prev.branchName || name,
      branchCode: prev.branchCode || code,
    }));
    setPra((prev) => ({
      ...prev,
      praBranchCode: prev.praBranchCode || code,
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
      branchName: data.company.branchName || branchLabel,
      branchCode: data.company.branchCode || branchCode,
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
      praBranchCode: data.pra.praBranchCode || branchCode,
      environment: data.pra.environment,
    }));
  }, [statusQuery.data, branchLabel, branchCode]);

  const connectFbrMut = useMutation({
    mutationFn: () =>
      connectFbr({
        branchCode,
        company,
        clientId: fbr.clientId,
        clientSecret: fbr.clientSecret,
        posId: fbr.posId,
        terminalId: fbr.terminalId,
        environment: fbr.environment,
      }),
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
    mutationFn: () =>
      connectPra({
        branchCode,
        company,
        registrationNumber: pra.registrationNumber,
        username: pra.username,
        password: pra.password,
        praBranchCode: pra.praBranchCode,
        environment: pra.environment,
      }),
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

  useEffect(() => {
    const id =
      section === "fbr"
        ? "tax-section-fbr"
        : section === "pra"
          ? "tax-section-pra"
          : section === "invoices"
            ? "tax-section-invoices"
            : "tax-section-overview";
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [section]);

  if (taxFeatures.isLoading) {
    return (
      <PageHeader
        title={isStore ? "General Store — FBR & PRA" : "FBR & PRA Integration"}
        subtitle="Checking tax authority access…"
      />
    );
  }

  // Pharmacy: leave if Super Admin has not enabled FBR/PRA.
  // Restaurant + general store: keep the page so staff can open FBR / PRA from the sidebar.
  if (!taxEnabled && !alwaysShowTaxPage) {
    return <Navigate to={erpEntryPathForRole(systemId, displayRole)} replace />;
  }

  const fbrStatus = statusQuery.data?.fbr.status ?? "disconnected";
  const praStatus = statusQuery.data?.pra.status ?? "disconnected";
  const platformFbr = Boolean(statusQuery.data?.fbrEnabled ?? taxFeatures.data?.fbrEnabled);
  const platformPra = Boolean(statusQuery.data?.praEnabled ?? taxFeatures.data?.praEnabled);
  const fbrEnabled = platformFbr;
  const praEnabled = platformPra;
  const invoices = invoicesQuery.data ?? [];
  const showCompany = section === "overview";
  const showFbr = section === "overview" || section === "fbr";
  const showPra = section === "overview" || section === "pra";
  const showInvoices = section === "overview" || section === "invoices";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isStore ? "General Store — FBR & PRA" : "FBR & PRA Integration"}
        subtitle={
          onMainSystem
            ? isStore
              ? "No store branch yet — connect FBR/PRA on the main business. Invoices submit automatically after POS sales."
              : "No store branch yet — connecting to the main business system. Invoices submit automatically after sales."
            : isStore
              ? `Connect General Store branch ${branchLabel} (${branchCode}) once — fiscal invoices submit automatically after checkout.`
              : `Connect ${branchLabel} (${branchCode}) once — invoices submit automatically after sales.`
        }
      />

      {!platformFbr && !platformPra ? (
        <div className={`${panelClass} border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100`}>
          FBR / PRA is not enabled yet for this business. Ask platform Super Admin to turn on FBR and/or PRA for{" "}
          <strong>this</strong> business, then return here to connect credentials.
        </div>
      ) : null}

      {alwaysShowTaxPage ? (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { to: "/pops/tax", label: "Overview", id: "overview" },
              { to: "/pops/tax/fbr", label: "FBR", id: "fbr" },
              { to: "/pops/tax/pra", label: "PRA", id: "pra" },
              { to: "/pops/tax/invoices", label: "Invoice queue", id: "invoices" },
            ] as const
          ).map((tab) => (
            <Link
              key={tab.id}
              to={tab.to}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                section === tab.id
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div id="tax-section-overview" className={`grid gap-3 sm:grid-cols-2 ${panelClass} p-4`}>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">FBR status</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={fbrEnabled ? statusTone(fbrStatus) : "neutral"}>
              {!fbrEnabled ? "Not enabled" : fbrStatus === "connected" ? "Connected" : fbrStatus}
            </Badge>
            <span className={`text-sm ${mutedClass}`}>
              Last: {formatWhen(statusQuery.data?.fbr.connectedAt)}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">PRA status</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={praEnabled ? statusTone(praStatus) : "neutral"}>
              {!praEnabled ? "Not enabled" : praStatus === "connected" ? "Connected" : praStatus}
            </Badge>
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

      {showCompany ? (
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
      ) : null}

      {showFbr ? (
      <section id="tax-section-fbr" className={`${panelClass} space-y-4 p-4`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">FBR Settings</h3>
        {!fbrEnabled ? (
          <p className={`text-sm ${mutedClass}`}>
            FBR is disabled for this business by the platform Super Admin.
          </p>
        ) : (
        <>
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
        </>
        )}
      </section>
      ) : null}

      {showPra ? (
      <section id="tax-section-pra" className={`${panelClass} space-y-4 p-4`}>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">PRA Settings</h3>
        {!praEnabled ? (
          <p className={`text-sm ${mutedClass}`}>
            PRA is disabled for this business by the platform Super Admin.
          </p>
        ) : (
        <>
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
        </>
        )}
      </section>
      ) : null}

      {showInvoices ? (
      <section id="tax-section-invoices" className="space-y-3">
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
      ) : null}
    </div>
  );
}
