import type { PraFiscalInvoice, PraInvoiceMode } from "@platform/contracts";
import {
  confirmPraClientPost,
  fetchTaxAuthorityStatus,
  fetchTaxFeaturesNormalized,
  isPraNetworkFailureMessage,
  issuePraInvoice,
  postPraPayloadFromClient,
  preparePraClientPost,
} from "../api/pra";

export const REAL_PRA_NOT_CONNECTED_MSG =
  "Real PRA is not connected. Please connect your PRA account on desktop Tax → Real PRA before uploading invoices.";

/** Issue Fake/Real PRA for a completed bill (does not print). */
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

/** Issue Fake/Real PRA for bill / store sale / pharmacy sale. */
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

/**
 * Real PRA: PostData from this device (shop Wi‑Fi IP when possible).
 * Never rely on Railway cloud submit alone for live e-IMS.
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
    throw new Error(
      prep.message || "PRA prepare failed — missing PostData credentials. Re-Connect Real PRA on desktop.",
    );
  }

  try {
    const posted = await postPraPayloadFromClient({
      postUrl: prep.postUrl,
      bearerToken: prep.bearerToken,
      payload: prep.payload,
    });

    const confirmed = await confirmPraClientPost({
      branchCode: input.branchCode,
      invoiceDbId: prep.invoiceDbId,
      invoiceNumber: posted.invoiceNumber,
      raw: posted.raw,
    });
    return { fiscal: confirmed.fiscal, message: confirmed.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isPraNetworkFailureMessage(msg) || /failed to fetch|network request failed/i.test(msg)) {
      throw new Error(
        `${msg} Tip: connect the phone to shop Wi‑Fi (PRA-whitelisted IP), then try RPRA / Pay again.`,
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}

export function praIssuedNotice(_mode: PraInvoiceMode, invoiceNumber: string): string {
  return `PRA invoice issued — ${invoiceNumber}`;
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

export type AutoIssuePraResult = {
  mode: PraInvoiceMode | null;
  fiscal: PraFiscalInvoice | null;
  notice: string;
  failed: boolean;
  blockedReal: boolean;
};

/**
 * When Fake/Real PRA is ON, issue fiscal for a completed bill (Real = client PostData).
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
          notice: REAL_PRA_NOT_CONNECTED_MSG,
          failed: true,
          blockedReal: true,
        };
      }
    } catch {
      return {
        mode,
        fiscal: null,
        notice: REAL_PRA_NOT_CONNECTED_MSG,
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
        notice:
          mode === "real"
            ? "Real PRA did not return invoice number/QR yet."
            : "PRA issued but invoice number/QR missing.",
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

export function isRealPraConnectedStatus(status: string | null | undefined): boolean {
  return status === "connected" || status === "expired";
}

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

export function canEmbedPraOnSlip(fiscal: PraFiscalInvoice | null | undefined): boolean {
  if (!fiscal) return false;
  const num = String(fiscal.invoiceNumber ?? "").trim();
  const qr = String(fiscal.qrPayload ?? "").trim();
  return Boolean(num) && Boolean(qr || num);
}

export function isPraFakeEnabled(features: {
  praFakeEnabled?: boolean;
}): boolean {
  return Boolean(features.praFakeEnabled);
}

export function isPraRealEnabled(features: {
  praRealEnabled?: boolean;
}): boolean {
  return Boolean(features.praRealEnabled);
}
