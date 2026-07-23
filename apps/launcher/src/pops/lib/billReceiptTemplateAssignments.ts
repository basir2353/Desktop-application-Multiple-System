import { getBillPrintTemplate, loadBillPrintTemplates } from "./billPrintTemplates";
import {
  DEFAULT_BILL_PRINT_SETTINGS,
  loadBillPrintSettings,
  normalizeBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";

/** POS receipt actions that can use different saved templates. */
export type BillPosReceiptAction = "order" | "pay";

/** Receipt-only template assignment (never kitchen/bar). */
export type BillReceiptTemplateAssignmentStore = {
  /** Template used as branch default receipt layout. */
  branchDefaultTemplateId: string | null;
  /** receipt printer profile id → template id */
  byReceiptPrinterId: Record<string, string>;
  /** POS action → template id (order slip / pay receipt). */
  byPosAction: Partial<Record<BillPosReceiptAction, string>>;
};

const STORAGE_KEY = "pops-bill-receipt-template-assign-v1";
export const BILL_RECEIPT_TEMPLATE_ASSIGN_CHANGED_EVENT =
  "pops-bill-receipt-template-assign-changed";

export const BILL_POS_RECEIPT_ACTIONS: {
  id: BillPosReceiptAction;
  label: string;
  description: string;
}[] = [
  {
    id: "order",
    label: "POS Order / Invoice",
    description: "Guest check & invoice print before or without final pay",
  },
  {
    id: "pay",
    label: "POS Pay",
    description: "Receipt printed after payment or split pay",
  },
];

type RootStore = Record<string, BillReceiptTemplateAssignmentStore>;

function emptyStore(): BillReceiptTemplateAssignmentStore {
  return { branchDefaultTemplateId: null, byReceiptPrinterId: {}, byPosAction: {} };
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

function normalizePosActions(
  raw: unknown,
): Partial<Record<BillPosReceiptAction, string>> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<BillPosReceiptAction, string>> = {};
  for (const key of ["order", "pay"] as const) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
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
    byPosAction: normalizePosActions(row.byPosAction),
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
    byPosAction: { ...store.byPosAction },
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
    byPosAction: { ...current.byPosAction },
  };

  saveBillReceiptTemplateAssignments(branchCode, next);
  return next;
}

/** Assign (or clear) a template for a POS receipt action. */
export function assignBillTemplateToPosAction(
  branchCode: string,
  action: BillPosReceiptAction,
  templateId: string | null,
): BillReceiptTemplateAssignmentStore {
  const current = loadBillReceiptTemplateAssignments(branchCode);
  const byPosAction = { ...current.byPosAction };
  if (templateId) byPosAction[action] = templateId;
  else delete byPosAction[action];
  const next: BillReceiptTemplateAssignmentStore = {
    ...current,
    byPosAction,
  };
  saveBillReceiptTemplateAssignments(branchCode, next);
  return next;
}

export function setBranchDefaultBillTemplate(
  branchCode: string,
  templateId: string | null,
): BillReceiptTemplateAssignmentStore {
  const current = loadBillReceiptTemplateAssignments(branchCode);
  const next: BillReceiptTemplateAssignmentStore = {
    ...current,
    branchDefaultTemplateId: templateId,
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

export function listPosActionsForTemplate(
  branchCode: string | undefined,
  templateId: string,
): BillPosReceiptAction[] {
  const store = loadBillReceiptTemplateAssignments(branchCode);
  return (Object.entries(store.byPosAction) as [BillPosReceiptAction, string][])
    .filter(([, tid]) => tid === templateId)
    .map(([action]) => action);
}

/**
 * Resolve receipt layout for print:
 * POS action template → printer-specific template → branch default → live settings.
 */
export function resolveBillPrintSettingsForReceipt(
  branchCode: string | undefined,
  receiptPrinterId?: string | null,
  posAction?: BillPosReceiptAction | null,
): BillPrintSettings {
  if (!branchCode) return DEFAULT_BILL_PRINT_SETTINGS;
  const assign = loadBillReceiptTemplateAssignments(branchCode);
  const templateId =
    (posAction && assign.byPosAction[posAction]) ||
    (receiptPrinterId && assign.byReceiptPrinterId[receiptPrinterId]) ||
    assign.branchDefaultTemplateId ||
    null;

  if (templateId) {
    const tpl = getBillPrintTemplate(branchCode, templateId);
    if (tpl) return normalizeBillPrintSettings(tpl.settings);
    const still = loadBillPrintTemplates(branchCode).find((t) => t.id === templateId);
    if (still) return normalizeBillPrintSettings(still.settings);
  }

  return loadBillPrintSettings(branchCode);
}
