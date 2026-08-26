import type { PraFiscalInvoice, PraInvoiceMode } from "@platform/contracts";
import {
  confirmPraClientPost,
  fetchTaxFeaturesNormalized,
  isPraNetworkFailureMessage,
  issuePraInvoice,
  postPraPayloadFromClient,
  preparePraClientPost,
} from "../../lib/praApi";
import { fetchTaxAuthorityStatus } from "../../lib/taxAuthorityApi";
import { printPraFiscalSlip } from "./printPraFiscal";

export const REAL_PRA_NOT_CONNECTED_MSG =
  "Real PRA is not Connected / Registered. Settings → Tax → Real PRA mein Connect karein, phir Close dobara try karein.";

/** Mode-specific Close / issue notices (FPRA vs Real PRA “voice”). */
export function praCloseIssueNotice(mode: PraInvoiceMode | null, kind: "missing" | "blocked"): string {
  if (mode === "real" || kind === "blocked") {
    return kind === "blocked"
      ? REAL_PRA_NOT_CONNECTED_MSG
      : "Real PRA did not return Invoice # / QR. Connect / Registered + Production token check karein.";
  }
  if (mode === "fake") {
    return "FPRA invoice issue nahi hui (Invoice # / QR missing). Settings → Tax → FPRA Active check karein.";
  }
  return "PRA invoice issue nahi hui (Invoice # / QR missing).";
}

/** Issue FPRA/Real PRA for a completed bill (does not print). */
export async function issuePraForBill(input: {
  branchCode: string;
  billId: string;
  mode: PraInvoiceMode;
}): Promise<{ fiscal: PraFiscalInvoice; message: string }> {
  return issuePraForSource({
    branchCode: input.branchCode,
    sourceType: "bill",
    sourceId: input.billId,
    mode: input.mode,
  });
}

/** Issue FPRA/Real PRA for bill / store sale / pharmacy sale. */
export async function issuePraForSource(input: {
  branchCode: string;
  sourceType: "bill" | "store_sale" | "pharmacy_sale";
  sourceId: string;
  mode: PraInvoiceMode;
}): Promise<{ fiscal: PraFiscalInvoice; message: string }> {
  if (input.mode === "real") {
    return issueRealPraWithClientRelay(input);
  }

  const result = await issuePraInvoice({
    branchCode: input.branchCode,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    mode: input.mode,
    force: false,
  });
  return { fiscal: result.fiscal, message: result.message };
}

/** Confirm saves bill + invoice row — retry when API blips after PRA already accepted PostData. */
async function confirmPraClientPostWithRetry(
  input: Parameters<typeof confirmPraClientPost>[0],
): Promise<Awaited<ReturnType<typeof confirmPraClientPost>>> {
  const delaysMs = [0, 1200, 3000];
  let lastErr: unknown;
  for (const delay of delaysMs) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
    try {
      return await confirmPraClientPost(input);
    } catch (err) {
      lastErr = err;
    }
  }
  const msg =
    lastErr instanceof Error
      ? lastErr.message
      : "Could not save Real PRA invoice on server after PRA accepted it.";
  throw new Error(
    `${msg} PRA may have the invoice — tap RPRA again to retry save (same USIN, no duplicate).`,
  );
}

/**
 * Real PRA: always PostData from this POS (shop IP). Never use Railway cloud submit —
 * that only produces "Cloud cannot reach PRA" noise.
 */
async function issueRealPraWithClientRelay(input: {
  branchCode: string;
  sourceType: "bill" | "store_sale" | "pharmacy_sale";
  sourceId: string;
}): Promise<{ fiscal: PraFiscalInvoice; message: string }> {
  const prep = await preparePraClientPost({
    branchCode: input.branchCode,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    force: true,
  });

  if (prep.alreadySubmitted && prep.fiscal) {
    return { fiscal: prep.fiscal, message: prep.message };
  }
  if (!prep.postUrl || !prep.bearerToken) {
    throw new Error(prep.message || "PRA prepare failed — missing PostData credentials. Re-Connect with Production.");
  }

  try {
    const posted = await postPraPayloadFromClient({
      postUrl: prep.postUrl,
      bearerToken: prep.bearerToken,
      payload: prep.payload,
    });

    const confirmed = await confirmPraClientPostWithRetry({
      branchCode: input.branchCode,
      invoiceDbId: prep.invoiceDbId,
      invoiceNumber: posted.invoiceNumber,
      raw: posted.raw,
    });
    return { fiscal: confirmed.fiscal, message: confirmed.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isPraNetworkFailureMessage(msg) || /failed to fetch|cors|pra-ims/i.test(msg)) {
      throw new Error(
        `${msg} POPS API is connected. Real PRA PostData goes from this PC to ims.pral.com.pk — check shop internet/firewall and Production token.`,
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}

export async function printIssuedPraSlip(
  fiscal: PraFiscalInvoice,
  options?:
    | string
    | null
    | {
        systemPrinterName?: string | null;
        paperWidthMm?: number;
        branchName?: string;
        branchCode?: string;
      },
): Promise<{ ok: boolean; error?: string }> {
  // Back-compat: older callers passed a printer name string as the 2nd arg.
  if (typeof options === "string" || options == null) {
    return printPraFiscalSlip(fiscal, {
      systemPrinterName: typeof options === "string" ? options : null,
    });
  }
  const systemPrinterName =
    typeof options.systemPrinterName === "string" ? options.systemPrinterName : null;
  return printPraFiscalSlip(fiscal, {
    systemPrinterName,
    paperWidthMm: options.paperWidthMm,
    branchName: options.branchName,
    branchCode: options.branchCode,
  });
}

export function praIssuedNotice(mode: PraInvoiceMode, invoiceNumber: string): string {
  if (mode === "real") {
    return `Real PRA uploaded — ${invoiceNumber}. Check PRA portal: e.pra.punjab.gov.pk → e-IMS`;
  }
  return `FPRA issued (local only) — ${invoiceNumber}. Tap RPRA to upload to PRA portal.`;
}

/** Resolve which PRA mode to run automatically (null = skip). Prefer real if both somehow true. */
export function resolveAutoPraMode(features: {
  praFakeEnabled?: boolean;
  praRealEnabled?: boolean;
}): PraInvoiceMode | null {
  const fake = Boolean(features.praFakeEnabled);
  const real = Boolean(features.praRealEnabled);
  if (real) return "real";
  if (fake) return "fake";
  return null;
}

/** RPRA button: FPRA Active only. Click sends that ticket to Real PRA + Real print. */
export function canShowRpraButton(features: {
  praFakeEnabled?: boolean;
  praRealEnabled?: boolean;
}): boolean {
  return resolveAutoPraMode(features) === "fake";
}

/** Hide RPRA on tickets that already have a Real PRA invoice. */
export function canShowRpraForBill(input: {
  praFakeEnabled?: boolean;
  praRealEnabled?: boolean;
  praMode?: string | null;
}): boolean {
  if (String(input.praMode ?? "").toLowerCase() === "real") return false;
  return canShowRpraButton(input);
}

export type AutoIssuePraResult = {
  mode: PraInvoiceMode | null;
  fiscal: PraFiscalInvoice | null;
  notice: string;
  failed: boolean;
  blockedReal: boolean;
};

/**
 * When FPRA/Real PRA is ON, issue fiscal for a completed bill (Real = client PostData).
 * Always re-fetches tax features so Pay never skips Real due to a stale cache.
 */
export async function autoIssuePraForCompletedBill(input: {
  branchCode: string;
  billId: string;
  sourceType?: "bill" | "store_sale" | "pharmacy_sale";
}): Promise<AutoIssuePraResult> {
  const features = await fetchTaxFeaturesNormalized().catch(() => ({
    fbrEnabled: false,
    praEnabled: false,
    praFakeEnabled: false,
    praRealEnabled: false,
  }));
  const mode = resolveAutoPraMode(features);
  if (!mode) {
    return { mode: null, fiscal: null, notice: "", failed: false, blockedReal: false };
  }

  const sourceType = input.sourceType ?? "bill";
  if (mode === "real") {
    try {
      const gate = await checkRealPraConnected(input.branchCode);
      if (!gate.connected) {
        return {
          mode,
          fiscal: null,
          notice: praCloseIssueNotice("real", "blocked"),
          failed: true,
          blockedReal: true,
        };
      }
    } catch {
      return {
        mode,
        fiscal: null,
        notice: praCloseIssueNotice("real", "blocked"),
        failed: true,
        blockedReal: true,
      };
    }
  }

  try {
    const issued = await issuePraForSource({
      branchCode: input.branchCode,
      sourceType,
      sourceId: input.billId,
      mode,
    });
    if (!canEmbedPraOnSlip(issued.fiscal)) {
      return {
        mode,
        fiscal: null,
        notice: praCloseIssueNotice(mode, "missing"),
        failed: true,
        blockedReal: false,
      };
    }
    return {
      mode,
      fiscal: issued.fiscal,
      notice: praIssuedNotice(mode, issued.fiscal.invoiceNumber),
      failed: false,
      blockedReal: false,
    };
  } catch (err) {
    return {
      mode,
      fiscal: null,
      notice: err instanceof Error ? err.message : "Could not issue PRA.",
      failed: true,
      blockedReal: false,
    };
  }
}

/** Real PRA is ready to upload when status is connected (or token expired but profile exists). */
export function isRealPraConnectedStatus(status: string | null | undefined): boolean {
  return status === "connected" || status === "expired";
}

/**
 * Check Tax Integration Real PRA connection for this branch.
 * FPRA does not need credentials — only Real does.
 */
export async function checkRealPraConnected(branchCode: string): Promise<{
  connected: boolean;
  status: string;
}> {
  const status = await fetchTaxAuthorityStatus(branchCode);
  const praStatus = status.pra.status;
  return {
    connected: isRealPraConnectedStatus(praStatus),
    status: praStatus,
  };
}

/** Only embed Invoice # + QR when fiscal has a real number (after successful issue). */
export function canEmbedPraOnSlip(fiscal: PraFiscalInvoice | null | undefined): boolean {
  if (!fiscal) return false;
  const num = String(fiscal.invoiceNumber ?? "").trim();
  const qr = String(fiscal.qrPayload ?? "").trim();
  return Boolean(num) && Boolean(qr || num);
}
