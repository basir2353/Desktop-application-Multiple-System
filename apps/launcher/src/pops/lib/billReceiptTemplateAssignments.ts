import { getBillPrintTemplate, loadBillPrintTemplates } from "./billPrintTemplates";
import {
  DEFAULT_BILL_PRINT_SETTINGS,
  loadBillPrintSettings,
  normalizeBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";

/** Receipt-only template assignment (never kitchen/bar). */
export type BillReceiptTemplateAssignmentStore = {
  /** Template used as branch default receipt layout. */
  branchDefaultTemplateId: string | null;
  /** receipt printer profile id → template id */
  byReceiptPrinterId: Record<string, string>;
};

const STORAGE_KEY = "pops-bill-receipt-template-assign-v1";
export const BILL_RECEIPT_TEMPLATE_ASSIGN_CHANGED_EVENT =
  "pops-bill-receipt-template-assign-changed";

type RootStore = Record<string, BillReceiptTemplateAssignmentStore>;

function emptyStore(): BillReceiptTemplateAssignmentStore {
  return { branchDefaultTemplateId: null, byReceiptPrinterId: {} };
}

function readRoot(): RootStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RootStore;
  } catch {
    return {};
  }
}

function writeRoot(root: RootStore, branchCode: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  window.dispatchEvent(
    new CustomEvent(BILL_RECEIPT_TEMPLATE_ASSIGN_CHANGED_EVENT, { detail: { branchCode } }),
  );
}

export function loadBillReceiptTemplateAssignments(
  branchCode: string | undefined,
): BillReceiptTemplateAssignmentStore {
  if (!branchCode) return emptyStore();
  const row = readRoot()[branchCode];
  if (!row || typeof row !== "object") return emptyStore();
  return {
    branchDefaultTemplateId:
      typeof row.branchDefaultTemplateId === "string" ? row.branchDefaultTemplateId : null,
    byReceiptPrinterId:
      row.byReceiptPrinterId && typeof row.byReceiptPrinterId === "object"
        ? { ...row.byReceiptPrinterId }
        : {},
  };
}

export function saveBillReceiptTemplateAssignments(
  branchCode: string,
  store: BillReceiptTemplateAssignmentStore,
): void {
  const root = readRoot();
  root[branchCode] = {
    branchDefaultTemplateId: store.branchDefaultTemplateId,
    byReceiptPrinterId: { ...store.byReceiptPrinterId },
  };
  writeRoot(root, branchCode);
}

/**
 * Assign a bill template to branch default and/or receipt printer profiles only.
 * Clears previous mapping for selected printers when reassigned.
 */
export function assignBillTemplateToReceiptTargets(
  branchCode: string,
  templateId: string,
  targets: { branchDefault: boolean; receiptPrinterIds: string[] },
): BillReceiptTemplateAssignmentStore {
  const current = loadBillReceiptTemplateAssignments(branchCode);
  const byReceiptPrinterId = { ...current.byReceiptPrinterId };

  // Clear previous receipt-printer links for this template, then apply selection.
  for (const [printerId, tid] of Object.entries(byReceiptPrinterId)) {
    if (tid === templateId) delete byReceiptPrinterId[printerId];
  }
  for (const printerId of targets.receiptPrinterIds) {
    byReceiptPrinterId[printerId] = templateId;
  }

  let branchDefaultTemplateId = current.branchDefaultTemplateId;
  if (targets.branchDefault) branchDefaultTemplateId = templateId;
  else if (branchDefaultTemplateId === templateId) branchDefaultTemplateId = null;

  const next: BillReceiptTemplateAssignmentStore = {
    branchDefaultTemplateId,
    byReceiptPrinterId,
  };

  saveBillReceiptTemplateAssignments(branchCode, next);
  return next;
}

/** Which receipt printers currently use this template. */
export function listReceiptPrinterIdsForTemplate(
  branchCode: string | undefined,
  templateId: string,
): string[] {
  const store = loadBillReceiptTemplateAssignments(branchCode);
  return Object.entries(store.byReceiptPrinterId)
    .filter(([, tid]) => tid === templateId)
    .map(([pid]) => pid);
}

export function isBranchDefaultTemplate(
  branchCode: string | undefined,
  templateId: string,
): boolean {
  return loadBillReceiptTemplateAssignments(branchCode).branchDefaultTemplateId === templateId;
}

/**
 * Resolve receipt layout for print: printer-specific template → branch settings → default.
 */
export function resolveBillPrintSettingsForReceipt(
  branchCode: string | undefined,
  receiptPrinterId?: string | null,
): BillPrintSettings {
  if (!branchCode) return DEFAULT_BILL_PRINT_SETTINGS;
  const assign = loadBillReceiptTemplateAssignments(branchCode);
  const templateId =
    (receiptPrinterId && assign.byReceiptPrinterId[receiptPrinterId]) ||
    assign.branchDefaultTemplateId ||
    null;

  if (templateId) {
    const tpl = getBillPrintTemplate(branchCode, templateId);
    if (tpl) return normalizeBillPrintSettings(tpl.settings);
    // Fall back if template was deleted but assignment remains.
    const still = loadBillPrintTemplates(branchCode).find((t) => t.id === templateId);
    if (still) return normalizeBillPrintSettings(still.settings);
  }

  return loadBillPrintSettings(branchCode);
}
