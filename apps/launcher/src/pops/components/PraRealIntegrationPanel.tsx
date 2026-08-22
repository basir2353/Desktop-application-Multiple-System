import type { TaxAuthorityStatus } from "@platform/contracts";
import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  connectPra,
  disconnectPra,
  fetchPraActivityLogs,
  fetchPraDashboard,
  preparePraClientTest,
  retryFailedPraInvoices,
  testPraConnection,
  updatePraSettings,
} from "../../lib/taxAuthorityApi";
import { pingPraFromClient } from "../../lib/praApi";
import { useSessionStore } from "../../stores/sessionStore";
import { fieldInputClass, fieldSelectClass, mutedClass, panelClass } from "../lib/themeClasses";
import { Badge } from "../ui/Badge";
import { SimpleTable } from "../ui/SimpleTable";

function FeatureActiveToggle({
  checked,
  disabled,
  onChange,
  label = "Enable PRA Integration",
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

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected" || status === "verified" || status === "submitted") return "success";
  if (status === "queued" || status === "pending" || status === "submitting" || status === "expired") {
    return "warning";
  }
  if (status === "failed" || status === "error" || status === "cancelled") return "danger";
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

function connectionLabel(status: string): string {
  if (status === "connected") return "Connected / Registered";
  if (status === "error") return "Authentication Failed";
  if (status === "expired") return "Token Expired";
  return "Not Connected";
}

type CompanyForm = {
  companyName: string;
  ntn: string;
  strn: string;
  province: string;
  branchName: string;
  branchCode: string;
};

type PraForm = {
  posId: string;
  accessCode: string;
  token: string;
  registrationNumber: string;
  username: string;
  password: string;
  praBranchCode: string;
  environment: "sandbox" | "production";
};

export function PraRealIntegrationPanel(props: {
  branchCode: string;
  branchLabel: string;
  praRealEnabled: boolean;
  /** FPRA Active: still show connect form so admin can prepare Real credentials. */
  credentialsUnlocked?: boolean;
  /** When true, hide dashboard cards / activity logs (shown on Dashboard tab). */
  setupOnly?: boolean;
  canToggleFeatures: boolean;
  toggleBusy: boolean;
  onToggleEnabled: (next: boolean) => void;
  status: TaxAuthorityStatus | undefined;
  company: CompanyForm;
  onCompanyChange: (next: CompanyForm) => void;
  pra: PraForm;
  onPraChange: (next: PraForm) => void;
  onMessage: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}): JSX.Element {
  const {
    branchCode,
    praRealEnabled,
    credentialsUnlocked = false,
    setupOnly = false,
    canToggleFeatures,
    toggleBusy,
    onToggleEnabled,
    status,
    company,
    onCompanyChange,
    pra,
    onPraChange,
    onMessage,
    onError,
  } = props;
  const showForm = praRealEnabled || credentialsUnlocked;
  const qc = useQueryClient();
  const organizationId = useSessionStore((s) => s.claims?.organizationId);
  const praStatus = status?.pra.status ?? "disconnected";

  const [settings, setSettings] = useState({
    autoSubmit: true,
    offlineQueue: true,
    retryFailed: true,
    maxRetryAttempts: 3,
  });

  useEffect(() => {
    if (!status?.pra) return;
    setSettings({
      autoSubmit: status.pra.autoSubmit ?? true,
      offlineQueue: status.pra.offlineQueue ?? true,
      retryFailed: status.pra.retryFailed ?? true,
      maxRetryAttempts: status.pra.maxRetryAttempts ?? 3,
    });
  }, [status?.pra]);

  const dashboardQuery = useQuery({
    queryKey: ["tax-authority", "pra-dashboard", organizationId, branchCode, "real"],
    enabled: showForm && !setupOnly && Boolean(organizationId),
    queryFn: () => fetchPraDashboard(branchCode, "real"),
    refetchInterval: 30_000,
  });

  const logsQuery = useQuery({
    queryKey: ["tax-authority", "pra-logs", organizationId, branchCode],
    enabled: showForm && !setupOnly && Boolean(organizationId),
    queryFn: () => fetchPraActivityLogs(branchCode, 40),
    refetchInterval: 30_000,
  });

  const buildPayload = () => ({
    branchCode,
    company: {
      companyName: company.companyName,
      ntn: company.ntn,
      strn: company.strn,
      businessType: "Restaurant",
      province: company.province || "Punjab",
      branchName: company.branchName,
      branchCode: company.branchCode || branchCode,
    },
    posId: pra.posId || pra.registrationNumber,
    accessCode: pra.accessCode || pra.password,
    token: pra.token,
    registrationNumber: pra.posId || pra.registrationNumber,
    username: pra.username,
    password: pra.accessCode || pra.password,
    praBranchCode: pra.praBranchCode,
    environment: pra.environment,
  });

  const validateConnect = (): string | null => {
    if (!company.companyName.trim() || !company.ntn.trim()) {
      return "Please complete Business Name and NTN / CNIC / PNTN.";
    }
    if (!company.province.trim() || !company.branchName.trim()) {
      return "Please complete Province and Branch Name.";
    }
    if (!(pra.posId || pra.registrationNumber).trim()) return "POS ID is required.";
    const hasAccess =
      Boolean((pra.accessCode || pra.password).trim()) || Boolean(status?.pra.passwordMasked);
    const hasToken = Boolean(pra.token.trim()) || Boolean(status?.pra.tokenMasked);
    if (!hasAccess) return "Access Code is required (or Connect once so it can be saved).";
    if (!hasToken) return "Bearer Token is required (or Connect once so it can be saved).";
    return null;
  };

  const connectMut = useMutation({
    mutationFn: async () => connectPra(buildPayload()),
    onSuccess: async (res) => {
      onError(null);
      // Clear only the secret inputs — placeholders will show "saved" masks from status.
      onPraChange({ ...pra, accessCode: "", password: "", token: "" });
      try {
        // FPRA Active: keep FPRA on — save credentials only until Real is turned Active.
        if (credentialsUnlocked && !praRealEnabled) {
          onMessage(`${res.message} · Credentials saved (FPRA stays Active).`);
        } else {
          const { updateTaxFeaturesNormalized } = await import("../../lib/praApi");
          await updateTaxFeaturesNormalized({
            praRealEnabled: true,
            praFakeEnabled: false,
          });
          onMessage(`${res.message} · Real PRA is now Active.`);
        }
      } catch {
        onMessage(res.message);
      }
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      onMessage(null);
      onError(err instanceof Error ? err.message : "Connect failed");
    },
  });

  const testMut = useMutation({
    mutationFn: async () => {
      // 1) Server check (cloud may be unreachable — that is OK / soft-success).
      const server = await testPraConnection(buildPayload());
      // 2) Live ping from this POS (shop IP via Vite proxy / Tauri).
      try {
        const prep = await preparePraClientTest(branchCode);
        await pingPraFromClient({
          postUrl: prep.postUrl,
          bearerToken: prep.bearerToken,
          payload: prep.payload,
        });
        return {
          ...server,
          status: "connected" as const,
          message: "Connection Successful — PRA reached from this POS (shop IP).",
        };
      } catch (clientErr) {
        const detail = clientErr instanceof Error ? clientErr.message : String(clientErr);
        // Credentials saved; only shop reachability failed.
        return {
          ...server,
          message: `${server.message} Live POS ping: ${detail}`,
        };
      }
    },
    onSuccess: async (res) => {
      onError(null);
      onMessage(res.message);
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      onMessage(null);
      onError(err instanceof Error ? err.message : "Test connection failed");
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnectPra(branchCode),
    onSuccess: async (res) => {
      onError(null);
      onMessage(res.message);
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      onMessage(null);
      onError(err instanceof Error ? err.message : "Disconnect failed");
    },
  });

  const settingsMut = useMutation({
    mutationFn: (patch: Partial<typeof settings>) =>
      updatePraSettings({ branchCode, ...patch }),
    onSuccess: async (saved) => {
      setSettings(saved);
      onError(null);
      onMessage("Invoice submission settings saved.");
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      onMessage(null);
      onError(err instanceof Error ? err.message : "Could not save settings");
    },
  });

  const retryMut = useMutation({
    mutationFn: () => retryFailedPraInvoices(branchCode),
    onSuccess: async (res) => {
      onError(null);
      onMessage(res.message);
      await qc.invalidateQueries({ queryKey: ["tax-authority"] });
    },
    onError: (err) => {
      onMessage(null);
      onError(err instanceof Error ? err.message : "Retry failed");
    },
  });

  const onConnect = () => {
    onError(null);
    onMessage(null);
    const err = validateConnect();
    if (err) {
      onError(err);
      return;
    }
    connectMut.mutate();
  };

  const onTest = () => {
    onError(null);
    onMessage(null);
    const err = validateConnect();
    if (err) {
      onError(err);
      return;
    }
    testMut.mutate();
  };

  const dash = dashboardQuery.data;
  const busy =
    connectMut.isPending ||
    testMut.isPending ||
    disconnectMut.isPending ||
    settingsMut.isPending ||
    retryMut.isPending;

  return (
    <section id="tax-section-pra-real" className={`${panelClass} space-y-5 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Tax → PRA Integration
          </h3>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            Connect this business PRA account. Every completed invoice can upload automatically.
          </p>
        </div>
        {canToggleFeatures ? (
          <FeatureActiveToggle
            checked={praRealEnabled}
            disabled={toggleBusy}
            onChange={onToggleEnabled}
            label={praRealEnabled ? "Active" : "Off"}
          />
        ) : null}
      </div>

      {!showForm ? (
        <p className={`text-sm ${mutedClass}`}>
          Enable PRA Integration to prepare invoices for PRA submission. POS still works when this
          is off — tax reporting stays local.
        </p>
      ) : (
        <>
          {credentialsUnlocked && !praRealEnabled ? (
            <p className={`text-sm ${mutedClass}`}>
              FPRA is Active — Pay uses FPRA. Connect credentials here, then use{" "}
              <strong>RPRA</strong> on paid tickets to send that invoice to Real PRA and print the
              Real slip. Turn Real Active to auto-submit every Pay (FPRA turns Off).
            </p>
          ) : null}
          {!setupOnly ? (
            <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className={`text-xs ${mutedClass}`}>Today&apos;s Submitted</p>
              <p className="mt-1 text-lg font-semibold">{dash?.todaySubmitted ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className={`text-xs ${mutedClass}`}>Today&apos;s Failed</p>
              <p className="mt-1 text-lg font-semibold">{dash?.todayFailed ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className={`text-xs ${mutedClass}`}>Pending Queue</p>
              <p className="mt-1 text-lg font-semibold">{dash?.pendingQueue ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className={`text-xs ${mutedClass}`}>Last Sync</p>
              <p className="mt-1 text-sm font-medium">{formatWhen(dash?.lastSyncAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(praStatus)}>{connectionLabel(praStatus)}</Badge>
            <Badge tone={pra.environment === "production" ? "warning" : "neutral"}>
              {pra.environment === "production" ? "Production" : "Sandbox"}
            </Badge>
            {dash?.lastError ? <Badge tone="danger">Last Error</Badge> : null}
            <Button type="button" disabled={busy || retryMut.isPending} onClick={() => retryMut.mutate()}>
              {retryMut.isPending ? "Retrying…" : "Retry Failed Invoices"}
            </Button>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <p>
              <span className={mutedClass}>Connected Since</span>
              <br />
              {formatWhen(status?.pra.connectedAt)}
            </p>
            <p>
              <span className={mutedClass}>Last Token Refresh</span>
              <br />
              {formatWhen(status?.pra.lastTokenRefreshAt)}
            </p>
            <p>
              <span className={mutedClass}>Last Invoice Sent</span>
              <br />
              {formatWhen(status?.pra.lastInvoiceSentAt)}
            </p>
          </div>
          {status?.pra.lastError || dash?.lastError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {status?.pra.lastError || dash?.lastError}
            </p>
          ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(praStatus)}>{connectionLabel(praStatus)}</Badge>
              <Badge tone={pra.environment === "production" ? "warning" : "neutral"}>
                {pra.environment === "production" ? "Production" : "Sandbox"}
              </Badge>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Environment</h4>
            <select
              className={fieldSelectClass}
              value={pra.environment}
              onChange={(e) =>
                onPraChange({
                  ...pra,
                  environment: e.target.value === "production" ? "production" : "sandbox",
                })
              }
            >
              <option value="production">Production</option>
              <option value="sandbox">Sandbox</option>
            </select>
            <p className={`mt-1 text-xs ${mutedClass}`}>
              Musa Cafe live POS token needs <strong>Production</strong>. Sandbox is only for PRA
              test tokens. After Connect, Access Code / Token fields clear on purpose — they stay
              saved on the server (see “On file” under each field). Cloud Test may say unreachable
              (normal); real submit happens on <strong>POS Pay</strong> from this PC.
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              Business Information
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">Business Name *</span>
                <input
                  className={fieldInputClass}
                  value={company.companyName}
                  onChange={(e) => onCompanyChange({ ...company, companyName: e.target.value })}
                  placeholder="ABC Restaurant"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  NTN / PNTN / CNIC *
                </span>
                <input
                  className={fieldInputClass}
                  value={company.ntn}
                  onChange={(e) => onCompanyChange({ ...company, ntn: e.target.value })}
                  placeholder="1234567 or 3520212345678"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  STRN (optional)
                </span>
                <input
                  className={fieldInputClass}
                  value={company.strn}
                  onChange={(e) => onCompanyChange({ ...company, strn: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">Province *</span>
                <select
                  className={fieldSelectClass}
                  value={company.province || "Punjab"}
                  onChange={(e) => onCompanyChange({ ...company, province: e.target.value })}
                >
                  <option value="Punjab">Punjab</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">Branch Name *</span>
                <input
                  className={fieldInputClass}
                  value={company.branchName}
                  onChange={(e) => onCompanyChange({ ...company, branchName: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">Branch Code *</span>
                <input
                  className={fieldInputClass}
                  value={company.branchCode}
                  onChange={(e) => onCompanyChange({ ...company, branchCode: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              PRA Credentials (from POS Details)
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">POS ID *</span>
                <input
                  className={fieldInputClass}
                  value={pra.posId}
                  onChange={(e) => onPraChange({ ...pra, posId: e.target.value })}
                  placeholder="197476"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">Access Code *</span>
                <input
                  type="password"
                  className={fieldInputClass}
                  placeholder={
                    status?.pra.passwordMasked
                      ? "Saved — leave blank to keep, or type a new code"
                      : "e.g. 1DE18D10"
                  }
                  value={pra.accessCode}
                  onChange={(e) => onPraChange({ ...pra, accessCode: e.target.value })}
                  autoComplete="new-password"
                />
                {status?.pra.passwordMasked ? (
                  <span className={`mt-1 block text-xs ${mutedClass}`}>
                    On file: {status.pra.passwordMasked}
                  </span>
                ) : null}
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  Bearer Token * (POS Details → Token)
                </span>
                <input
                  type="password"
                  className={fieldInputClass}
                  placeholder={
                    status?.pra.tokenMasked
                      ? "Saved — leave blank to keep, or paste a new token"
                      : "Paste token from PRA POS Details"
                  }
                  value={pra.token}
                  onChange={(e) => onPraChange({ ...pra, token: e.target.value })}
                  autoComplete="new-password"
                />
                {status?.pra.tokenMasked ? (
                  <span className={`mt-1 block text-xs ${mutedClass}`}>
                    On file: {status.pra.tokenMasked}
                  </span>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  CNIC / Username (optional)
                </span>
                <input
                  className={fieldInputClass}
                  value={pra.username}
                  onChange={(e) => onPraChange({ ...pra, username: e.target.value })}
                  placeholder="3220381740551"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  PRA Branch Code (optional)
                </span>
                <input
                  className={fieldInputClass}
                  value={pra.praBranchCode}
                  onChange={(e) => onPraChange({ ...pra, praBranchCode: e.target.value })}
                />
              </label>
            </div>
            <p className={`mt-2 text-xs ${mutedClass}`}>
              Use Production only after PRA whitelists your server IP (
              eims@pra.punjab.gov.pk). Sandbox token from PRA manual works without whitelist.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={onConnect}>
              {connectMut.isPending ? "Connecting…" : "Connect"}
            </Button>
            <Button type="button" disabled={busy} onClick={onTest}>
              {testMut.isPending ? "Testing…" : "Test Connection"}
            </Button>
            <Button
              type="button"
              disabled={busy || praStatus === "disconnected"}
              onClick={() => disconnectMut.mutate()}
            >
              {disconnectMut.isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              Invoice Submission Settings
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <span>
                  Auto Submit
                  <span className={`mt-0.5 block text-xs ${mutedClass}`}>
                    Upload after payment
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoSubmit}
                  disabled={settingsMut.isPending}
                  onChange={(e) => settingsMut.mutate({ autoSubmit: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <span>
                  Offline Queue
                  <span className={`mt-0.5 block text-xs ${mutedClass}`}>
                    Queue when network fails
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.offlineQueue}
                  disabled={settingsMut.isPending}
                  onChange={(e) => settingsMut.mutate({ offlineQueue: e.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <span>
                  Retry Failed Invoices
                  <span className={`mt-0.5 block text-xs ${mutedClass}`}>
                    Allow automatic / manual retries
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.retryFailed}
                  disabled={settingsMut.isPending}
                  onChange={(e) => settingsMut.mutate({ retryFailed: e.target.checked })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600 dark:text-slate-300">
                  Maximum Retry Attempts
                </span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  className={fieldInputClass}
                  value={settings.maxRetryAttempts}
                  disabled={settingsMut.isPending}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setSettings((s) => ({ ...s, maxRetryAttempts: n }));
                  }}
                  onBlur={() =>
                    settingsMut.mutate({ maxRetryAttempts: settings.maxRetryAttempts })
                  }
                />
              </label>
            </div>
          </div>

          {!setupOnly ? (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              Activity Logs
            </h4>
            <SimpleTable
              rowKey={(r) => String(r.id)}
              columns={[
                {
                  key: "createdAt",
                  header: "Date / Time",
                  render: (r) => formatWhen(String(r.createdAt)),
                },
                {
                  key: "invoiceNumber",
                  header: "Invoice",
                  render: (r) => String(r.invoiceNumber ?? "—"),
                },
                {
                  key: "praInvoiceNumber",
                  header: "PRA Invoice #",
                  render: (r) => String(r.praInvoiceNumber ?? "—"),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <Badge tone={statusTone(String(r.status))}>{String(r.status)}</Badge>
                  ),
                },
                {
                  key: "errorMessage",
                  header: "Error",
                  render: (r) => String(r.errorMessage ?? "—"),
                },
                {
                  key: "retryCount",
                  header: "Retries",
                  render: (r) => String(r.retryCount ?? 0),
                },
              ]}
              rows={(logsQuery.data ?? []) as unknown as Record<string, unknown>[]}
            />
            {logsQuery.isLoading ? (
              <p className={`mt-2 text-sm ${mutedClass}`}>Loading activity…</p>
            ) : null}
            {!logsQuery.isLoading && (logsQuery.data?.length ?? 0) === 0 ? (
              <p className={`mt-2 text-sm ${mutedClass}`}>No PRA activity yet.</p>
            ) : null}
          </div>
          ) : null}
        </>
      )}
    </section>
  );
}
