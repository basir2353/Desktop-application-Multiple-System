import type { PraFiscalInvoice, TaxInvoice } from "@platform/contracts";
import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { fetchPraFiscalForSource, updateTaxFeaturesNormalized } from "../../../lib/praApi";
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
import { fetchCompletedOrders } from "../../api/billing";
import {
  isPraFakeEnabled,
  isPraRealEnabled,
  isTaxAuthorityEnabled,
  useTaxAuthorityFeatures,
} from "../../hooks/useTaxAuthorityFeatures";
import { printIssuedPraSlip } from "../../lib/praIssueFlow";
import { preparePraReceiptFooter } from "../../lib/praReceiptFooter";
import {
  billToPrintInput,
  printHtmlDocumentAndWait,
  printReceiptDetailed,
} from "../../lib/printTicket";
import { resolveBillPrintSettingsForReceipt } from "../../lib/billReceiptTemplateAssignments";
import { loadThermalPrintSettings } from "../../lib/thermalPrintSettings";
import { resolveReceiptPrinter } from "../../lib/printerRouting";
import {
  erpEntryPathForRole,
  hasAnyPermission,
  sessionCanManageUsers,
} from "../../lib/roleAccess";
import { fieldInputClass, fieldSelectClass, mutedClass, panelClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { useSessionStore } from "../../../stores/sessionStore";

/** On/Off switch for FBR / Fake PRA / Real PRA on Tax pages. */
function FeatureActiveToggle({
  checked,
  disabled,
  onChange,
  label = "Active",
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex items-center gap-2 text-sm font-medium",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400",
      ].join(" ")}
    >
      <span
        className={[
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
        ].join(" ")}
        aria-hidden
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "right-0.5" : "left-0.5",
          ].join(" ")}
        />
      </span>
      {label}
    </button>
  );
}

/** Org-level attachment when the business has no store branch selected. */
const MAIN_SYSTEM_BRANCH_CODE = "MAIN";
const MAIN_SYSTEM_BRANCH_NAME = "Main System";

type TaxSection = "overview" | "fbr" | "pra-real" | "pra-fake" | "invoices";

function taxSectionFromPath(pathname: string): TaxSection {
  if (pathname.endsWith("/tax/fbr")) return "fbr";
  if (pathname.endsWith("/tax/pra-fake")) return "pra-fake";
  if (pathname.endsWith("/tax/pra-real") || pathname.endsWith("/tax/pra")) return "pra-real";
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

function fiscalFromInvoice(inv: TaxInvoice, branchCode: string): PraFiscalInvoice {
  const invoiceNumber = inv.authorityInvoiceNumber ?? inv.id;
  return {
    mode: inv.invoiceMode === "fake" ? "fake" : "real",
    invoiceNumber,
    invoiceId: inv.id,
    qrPayload: inv.qrPayload ?? invoiceNumber,
    usin: invoiceNumber,
    issuedAt: inv.createdAt,
    sellerName: "",
    ntn: "",
    strn: "",
    branchCode,
    sourceRef: inv.sourceRef,
    taxableAmountPkr: inv.taxableAmountPkr,
    taxAmountPkr: inv.taxAmountPkr,
    totalAmountPkr: inv.taxableAmountPkr + inv.taxAmountPkr,
    lines: [],
  };
}

export function TaxPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const claims = useSessionStore((s) => s.claims);
  const systemId = useActiveSystemId();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = useMemo(() => taxSectionFromPath(pathname), [pathname]);
  const qc = useQueryClient();
  const branchCode = branch?.code || MAIN_SYSTEM_BRANCH_CODE;
  const branchLabel = branch?.name || MAIN_SYSTEM_BRANCH_NAME;
  const isStore = systemId === "general-store";
  const taxFeatures = useTaxAuthorityFeatures();
  /** Tax page is available when Super Admin enabled FBR and/or PRA for this business. */
  const taxEnabled = isTaxAuthorityEnabled(taxFeatures.data);
  const canToggleFeatures =
    sessionCanManageUsers(claims) ||
    hasAnyPermission(claims?.permissions, ["pops.accounting.manage", "pops.users.manage"]);
  const onMainSystem = !branch?.code;

  const [company, setCompany] = useState<CompanyForm>(
    emptyCompany(MAIN_SYSTEM_BRANCH_NAME, MAIN_SYSTEM_BRANCH_CODE),
  );
  const [fbr, setFbr] = useState<FbrForm>(emptyFbr());
  const [pra, setPra] = useState<PraForm>(emptyPra(MAIN_SYSTEM_BRANCH_CODE));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["tax-authority", "status", branchCode],
    enabled: taxEnabled,
    queryFn: () => fetchTaxAuthorityStatus(branchCode),
  });

  const invoicesQuery = useQuery({
    queryKey: ["tax-authority", "invoices", branchCode],
    enabled: taxEnabled,
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

  const connectFbrSmart = () => {
    setError(null);
    setMessage(null);
    if (
      !company.companyName ||
      !company.ntn ||
      !company.strn ||
      !company.businessType ||
      !company.province ||
      !company.branchCode ||
      !fbr.posId ||
      !fbr.terminalId
    ) {
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

  const featuresMut = useMutation({
    mutationFn: updateTaxFeaturesNormalized,
    onSuccess: async (saved) => {
      setError(null);
      const mode = saved.praRealEnabled
        ? "Real PRA ON"
        : saved.praFakeEnabled
          ? "Fake PRA ON"
          : "PRA off";
      setMessage(
        `Saved — FBR ${saved.fbrEnabled ? "ON" : "OFF"} · ${mode}. New sales use the active mode.`,
      );
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Could not update tax features.");
    },
  });

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
      setPra((prev) => ({ ...prev, password: "" }));
      // Once Real PRA connects, switch active mode to Real (turn Fake off).
      try {
        await updateTaxFeaturesNormalized({
          praRealEnabled: true,
          praFakeEnabled: false,
        });
        setMessage(`${res.message} · Real PRA is now Active (Fake PRA off).`);
      } catch {
        setMessage(res.message);
      }
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
        : section === "pra-real"
          ? "tax-section-pra-real"
          : section === "pra-fake"
            ? "tax-section-pra-fake"
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

  if (!taxEnabled) {
    return <Navigate to={erpEntryPathForRole(systemId, displayRole)} replace />;
  }

  const fbrStatus = statusQuery.data?.fbr.status ?? "disconnected";
  const praStatus = statusQuery.data?.pra.status ?? "disconnected";
  const fbrEnabled = statusQuery.data?.fbrEnabled ?? taxFeatures.data?.fbrEnabled ?? false;
  // Mutual exclusive at runtime — prefer Real if both somehow true.
  let praFakeEnabled =
    statusQuery.data?.praFakeEnabled ?? isPraFakeEnabled(taxFeatures.data);
  let praRealEnabled =
    statusQuery.data?.praRealEnabled ?? isPraRealEnabled(taxFeatures.data);
  if (praFakeEnabled && praRealEnabled) {
    praFakeEnabled = false;
  }
  const invoices = invoicesQuery.data ?? [];
  // Dedicated tabs always show (with Active toggle). Overview only lists currently Active panels.
  const showCompany = section === "overview";
  const showFbr = section === "fbr" || (section === "overview" && fbrEnabled);
  const showPraReal =
    section === "pra-real" || (section === "overview" && praRealEnabled);
  const showPraFake =
    section === "pra-fake" || (section === "overview" && praFakeEnabled);
  const showInvoices = section === "overview" || section === "invoices";
  const statusCols =
    [fbrEnabled, praRealEnabled, praFakeEnabled].filter(Boolean).length || 1;
  const toggleBusy = featuresMut.isPending;

  function setFbrActive(on: boolean): void {
    featuresMut.mutate({ fbrEnabled: on });
  }
  function setFakePraActive(on: boolean): void {
    featuresMut.mutate(
      on
        ? { praFakeEnabled: true, praRealEnabled: false }
        : { praFakeEnabled: false },
    );
  }
  function setRealPraActive(on: boolean): void {
    featuresMut.mutate(
      on
        ? { praRealEnabled: true, praFakeEnabled: false }
        : { praRealEnabled: false },
    );
  }

  async function printInvoice(inv: TaxInvoice): Promise<void> {
    setActionBusyId(inv.id);
    setError(null);
    try {
      if (inv.authority === "pra") {
        let fiscal: PraFiscalInvoice | null = null;
        const sourceId = inv.sourceId;

        // Prefer full bill receipt (same POS slip design as Pay) when we can resolve the order.
        if (inv.sourceType === "bill") {
          try {
            const orders = await fetchCompletedOrders(branchCode);
            const bill =
              (sourceId ? orders.find((b) => b.id === sourceId) : undefined) ??
              orders.find(
                (b) =>
                  b.billRef === inv.sourceRef ||
                  b.orderRef === inv.sourceRef ||
                  b.praInvoiceNumber === inv.authorityInvoiceNumber,
              );
            if (bill) {
              if (sourceId || bill.id) {
                fiscal = await fetchPraFiscalForSource({
                  branchCode,
                  sourceType: "bill",
                  sourceId: sourceId || bill.id,
                });
              }
              if (!fiscal) fiscal = fiscalFromInvoice(inv, branchCode);
              // Enrich lines / totals from the real bill when fiscal lines are empty.
              if (!fiscal.lines?.length && bill.lines?.length) {
                fiscal = {
                  ...fiscal,
                  sellerName: fiscal.sellerName || branchLabel,
                  sourceRef: bill.billRef,
                  taxableAmountPkr: Math.max(0, bill.subtotal - bill.discount),
                  taxAmountPkr: bill.tax,
                  totalAmountPkr: bill.total,
                  lines: bill.lines.map((l) => ({
                    label: l.label,
                    qty: l.qty,
                    unitPrice: l.unitPrice,
                  })),
                };
              }

              const sessionUserId = useSessionStore.getState().claims?.sub;
              const receiptProfile = resolveReceiptPrinter(branchCode, sessionUserId);
              const thermal = loadThermalPrintSettings(branchCode);
              const paperSize =
                thermal.defaultPaperSize === "custom"
                  ? "custom"
                  : (receiptProfile?.paperSize ?? thermal.defaultPaperSize);
              const praFiscal = await preparePraReceiptFooter({
                mode: fiscal.mode,
                invoiceNumber: fiscal.invoiceNumber,
                orderRef: bill.orderRef ?? bill.billRef,
                qrPayload: fiscal.qrPayload?.trim() || fiscal.invoiceNumber,
              });
              const result = await printReceiptDetailed({
                ...billToPrintInput(branchLabel, branchCode, bill),
                paperSize,
                thermal,
                systemPrinterName: receiptProfile?.systemPrinterName,
                printerName: receiptProfile?.name,
                billPrintSettings: resolveBillPrintSettingsForReceipt(
                  branchCode,
                  receiptProfile?.id,
                ),
                praFiscal,
              });
              if (!result.ok) {
                setError(result.error ?? "Could not print invoice.");
                return;
              }
              setMessage(`Printed invoice ${fiscal.invoiceNumber}`);
              return;
            }
          } catch {
            /* fall through to fiscal-only print */
          }
        }

        if (
          sourceId &&
          (inv.sourceType === "bill" ||
            inv.sourceType === "store_sale" ||
            inv.sourceType === "pharmacy_sale")
        ) {
          fiscal = await fetchPraFiscalForSource({
            branchCode,
            sourceType: inv.sourceType,
            sourceId,
          });
        }
        if (!fiscal) {
          fiscal = fiscalFromInvoice(inv, branchCode);
        }
        fiscal = {
          ...fiscal,
          sellerName: fiscal.sellerName || branchLabel,
        };
        const result = await printIssuedPraSlip(fiscal, {
          branchName: branchLabel,
          branchCode,
        });
        if (!result.ok) {
          setError(result.error ?? "Could not print invoice.");
          return;
        }
        setMessage(`Printed invoice ${fiscal.invoiceNumber}`);
        return;
      }

      // FBR — best-effort print of reference
      const ref = inv.authorityInvoiceNumber ?? inv.qrPayload ?? inv.sourceRef;
      const html = `<!DOCTYPE html><html><head><title>FBR ${ref}</title>
        <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:16px;margin:0 0 8px} p{margin:4px 0;font-size:13px}</style></head>
        <body><h1>FBR Invoice</h1>
        <p><strong>Reference:</strong> ${ref}</p>
        <p><strong>Source:</strong> ${inv.sourceRef}</p>
        <p><strong>Status:</strong> ${inv.status}</p>
        <p><strong>Taxable:</strong> Rs ${inv.taxableAmountPkr.toLocaleString()}</p>
        <p><strong>Tax:</strong> Rs ${inv.taxAmountPkr.toLocaleString()}</p>
        </body></html>`;
      const opened = await printHtmlDocumentAndWait(html, `FBR ${ref}`);
      if (!opened) setError("Could not open FBR print dialog.");
      else setMessage(`Printed FBR reference ${ref}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Print failed");
    } finally {
      setActionBusyId(null);
    }
  }

  function viewOrder(inv: TaxInvoice): void {
    navigate(`/pops/orders?q=${encodeURIComponent(inv.sourceRef)}`, {
      state: { search: inv.sourceRef, sourceRef: inv.sourceRef },
    });
  }

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

      <div className="flex flex-wrap gap-2">
        {(
          [
            { to: "/pops/tax", label: "Overview", id: "overview" as const, show: true },
            {
              to: "/pops/tax/fbr",
              label: "FBR Integration",
              id: "fbr" as const,
              show: true,
            },
            {
              to: "/pops/tax/pra-real",
              label: "Real PRA Integration",
              id: "pra-real" as const,
              show: true,
            },
            {
              to: "/pops/tax/pra-fake",
              label: "Fake PRA Integration",
              id: "pra-fake" as const,
              show: true,
            },
            {
              to: "/pops/tax/invoices",
              label: "Invoice queue",
              id: "invoices" as const,
              show: true,
            },
          ] as const
        )
          .filter((tab) => tab.show)
          .map((tab) => (
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

      {!isTaxAuthorityEnabled(taxFeatures.data) ? (
        <div
          className={`${panelClass} border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100`}
        >
          FBR / PRA is not enabled yet for this business. After Super Admin turns on FBR and/or PRA, return
          here to connect credentials. Sales will then submit fiscal invoices automatically.
        </div>
      ) : null}

      <div
        id="tax-section-overview"
        className={`grid gap-3 ${statusCols >= 2 ? "sm:grid-cols-2" : ""} ${statusCols >= 3 ? "lg:grid-cols-3" : ""} ${panelClass} p-4`}
      >
        {fbrEnabled ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">FBR status</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={statusTone(fbrStatus)}>
                {fbrStatus === "connected" ? "Connected" : fbrStatus}
              </Badge>
              <span className={`text-sm ${mutedClass}`}>
                Last: {formatWhen(statusQuery.data?.fbr.connectedAt)}
              </span>
            </div>
          </div>
        ) : null}
        {praRealEnabled ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Real PRA status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="success">Real PRA assigned</Badge>
              <Badge tone={statusTone(praStatus)}>
                {praStatus === "connected" ? "Connected" : praStatus}
              </Badge>
              <span className={`text-sm ${mutedClass}`}>
                Last: {formatWhen(statusQuery.data?.pra.connectedAt)}
              </span>
            </div>
          </div>
        ) : null}
        {praFakeEnabled ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Fake PRA status</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="success">Active</Badge>
              <Badge tone="success">PRA ready</Badge>
              <span className={`text-sm ${mutedClass}`}>
                Invoices generate like PRA on sales
              </span>
            </div>
          </div>
        ) : null}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              FBR Integration
            </h3>
            {canToggleFeatures ? (
              <FeatureActiveToggle
                checked={fbrEnabled}
                disabled={toggleBusy}
                onChange={setFbrActive}
                label={fbrEnabled ? "Active" : "Off"}
              />
            ) : null}
          </div>
          {fbrEnabled ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">Enabled</Badge>
                <Badge tone={statusTone(fbrStatus)}>
                  {fbrStatus === "connected" ? "Connected" : fbrStatus}
                </Badge>
              </div>
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
                  <span className="mb-1 block text-slate-600 dark:text-slate-300">
                    Client Secret / Security Token
                  </span>
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
                  <span className="mb-1 block text-slate-600 dark:text-slate-300">
                    API Environment
                  </span>
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
                  {connectFbrMut.isPending || refreshFbrMut.isPending
                    ? "Connecting…"
                    : "Connect FBR"}
                </Button>
              </div>
            </>
          ) : (
            <p className={`text-sm ${mutedClass}`}>
              Turn Active on to use FBR for this business, then connect credentials below.
            </p>
          )}
        </section>
      ) : null}

      {showPraReal ? (
        <section id="tax-section-pra-real" className={`${panelClass} space-y-4 p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Real PRA Integration
            </h3>
            {canToggleFeatures ? (
              <FeatureActiveToggle
                checked={praRealEnabled}
                disabled={toggleBusy}
                onChange={setRealPraActive}
                label={praRealEnabled ? "Active" : "Off"}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {praRealEnabled ? <Badge tone="success">Real PRA Active</Badge> : (
              <Badge tone="neutral">Not active — Fake PRA can stay on</Badge>
            )}
            <Badge tone={statusTone(praStatus)}>
              {praStatus === "connected" ? "Connected" : praStatus}
            </Badge>
          </div>
          <p className={`text-sm ${mutedClass}`}>
            Connect Real PRA credentials below. After a successful Connect, Real becomes Active and
            Fake turns off automatically. You can also flip Active here anytime (Fake ↔ Real are
            mutually exclusive).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600 dark:text-slate-300">
                Registration Number
              </span>
              <input
                className={fieldInputClass}
                value={pra.registrationNumber}
                onChange={(e) =>
                  setPra((prev) => ({ ...prev, registrationNumber: e.target.value }))
                }
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
              <span className="mb-1 block text-slate-600 dark:text-slate-300">
                Password / API Key
              </span>
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
                onChange={(e) =>
                  setPra((prev) => ({ ...prev, praBranchCode: e.target.value }))
                }
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
              {connectPraMut.isPending || refreshPraMut.isPending
                ? "Connecting…"
                : "Connect PRA"}
            </Button>
          </div>
        </section>
      ) : null}

      {showPraFake ? (
        <section id="tax-section-pra-fake" className={`${panelClass} space-y-3 p-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Fake PRA Integration
            </h3>
            {canToggleFeatures ? (
              <FeatureActiveToggle
                checked={praFakeEnabled}
                disabled={toggleBusy}
                onChange={setFakePraActive}
                label={praFakeEnabled ? "Active" : "Off"}
              />
            ) : null}
          </div>
          {praFakeEnabled ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">Enabled</Badge>
                <Badge tone="success">PRA ready</Badge>
              </div>
              <p className={`text-sm ${mutedClass}`}>
                Invoices generate like PRA on sales. Fiscal invoices auto-generate when you take
                payment. Receipts match Real PRA (no demo labels). No PRA credentials needed. Fake
                stays Active until Real PRA is connected — or turn Real Active yourself. Only one
                PRA mode can be Active.
              </p>
            </>
          ) : (
            <p className={`text-sm ${mutedClass}`}>
              Fake PRA is off. Turn Active on to use local fiscal Invoice # + QR (this turns Real PRA
              off).
            </p>
          )}
        </section>
      ) : null}

      {showInvoices ? (
        <section id="tax-section-invoices" className="space-y-3">
          <PageHeader
            title="Invoice queue"
            subtitle="Submitted and pending FBR / PRA invoices for this branch."
          />
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
                render: (r) => (
                  <Badge tone={statusTone(String(r.status))}>{String(r.status)}</Badge>
                ),
              },
              {
                key: "authorityInvoiceNumber",
                header: "Reference / QR",
                render: (r) => String(r.authorityInvoiceNumber ?? r.qrPayload ?? "—"),
              },
              {
                key: "id",
                id: "actions",
                header: "Actions",
                render: (r) => {
                  const inv = r as unknown as TaxInvoice;
                  const busy = actionBusyId === inv.id;
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void printInvoice(inv);
                        }}
                      >
                        {busy ? "Printing…" : "Print Invoice"}
                      </Button>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          viewOrder(inv);
                        }}
                      >
                        View Order
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            rows={invoices as unknown as Record<string, unknown>[]}
          />
          {invoicesQuery.isLoading ? (
            <p className={`text-sm ${mutedClass}`}>Loading invoices…</p>
          ) : null}
          {!invoicesQuery.isLoading && invoices.length === 0 ? (
            <p className={`text-sm ${mutedClass}`}>
              No tax invoices yet. Complete a sale after connecting.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
