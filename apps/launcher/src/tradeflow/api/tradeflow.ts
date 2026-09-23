import type {
  CreateTradeFlowBooking,
  CreateTradeFlowContra,
  CreateTradeFlowCustomer,
  CreateTradeFlowExpense,
  CreateTradeFlowInvoice,
  CreateTradeFlowItem,
  CreateTradeFlowJournal,
  CreateTradeFlowNote,
  CreateTradeFlowPayment,
  CreateTradeFlowPurchase,
  CreateTradeFlowReturn,
  CreateTradeFlowSalesPerson,
  CreateTradeFlowSupplier,
  TradeFlowAccount,
  TradeFlowBooking,
  TradeFlowContra,
  TradeFlowCustomer,
  TradeFlowDashboard,
  TradeFlowExpense,
  TradeFlowInvoice,
  TradeFlowItem,
  TradeFlowJournal,
  TradeFlowLedger,
  TradeFlowNote,
  TradeFlowPayment,
  TradeFlowPurchase,
  TradeFlowReturn,
  TradeFlowSalesPerson,
  TradeFlowSettings,
  TradeFlowSupplier,
  TradeFlowWhatsapp,
  UpdateTradeFlowCustomer,
  UpdateTradeFlowItem,
  UpdateTradeFlowSettings,
  UpdateTradeFlowSupplier,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

async function parseError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) msg = body.message;
  } catch {
    // ignore
  }
  throw new Error(msg);
}

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) return parseError(res, fallback);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await authFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) return parseError(res, fallback);
  return (await res.json()) as T;
}

async function patchJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await authFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) return parseError(res, fallback);
  return (await res.json()) as T;
}

export async function fetchTradeFlowStatus() {
  return getJson<{ ready: boolean; system: "tradeflow"; modulesReady: string[] }>("/v1/tradeflow/status", "Could not load TradeFlow status");
}

export async function fetchTradeFlowDashboard(branchCode: string): Promise<TradeFlowDashboard> {
  return getJson(`/v1/tradeflow/dashboard?branchCode=${encodeURIComponent(branchCode)}`, "Could not load dashboard");
}

export async function fetchTradeFlowCustomers(branchCode: string): Promise<TradeFlowCustomer[]> {
  return getJson(`/v1/tradeflow/customers?branchCode=${encodeURIComponent(branchCode)}`, "Could not load customers");
}

export async function createTradeFlowCustomer(input: CreateTradeFlowCustomer): Promise<TradeFlowCustomer> {
  return postJson("/v1/tradeflow/customers", input, "Could not save customer");
}

export async function updateTradeFlowCustomer(customerId: string, input: UpdateTradeFlowCustomer): Promise<TradeFlowCustomer> {
  return patchJson(`/v1/tradeflow/customers/${customerId}`, input, "Could not update customer");
}

export async function fetchTradeFlowLedger(branchCode: string, customerId: string, filter = "all"): Promise<TradeFlowLedger> {
  return getJson(
    `/v1/tradeflow/customers/${customerId}/ledger?branchCode=${encodeURIComponent(branchCode)}&filter=${encodeURIComponent(filter)}`,
    "Could not load ledger",
  );
}

export async function fetchTradeFlowItems(branchCode: string, customerId?: string): Promise<TradeFlowItem[]> {
  const q = new URLSearchParams({ branchCode });
  if (customerId) q.set("customerId", customerId);
  return getJson(`/v1/tradeflow/items?${q}`, "Could not load items");
}

export async function createTradeFlowItem(input: CreateTradeFlowItem): Promise<TradeFlowItem> {
  return postJson("/v1/tradeflow/items", input, "Could not save item");
}

export async function updateTradeFlowItem(itemId: string, input: UpdateTradeFlowItem): Promise<TradeFlowItem> {
  return patchJson(`/v1/tradeflow/items/${itemId}`, input, "Could not update item");
}

export async function fetchTradeFlowSalesPersons(branchCode: string): Promise<TradeFlowSalesPerson[]> {
  return getJson(`/v1/tradeflow/sales-persons?branchCode=${encodeURIComponent(branchCode)}`, "Could not load sales persons");
}

export async function createTradeFlowSalesPerson(input: CreateTradeFlowSalesPerson): Promise<TradeFlowSalesPerson> {
  return postJson("/v1/tradeflow/sales-persons", input, "Could not save sales person");
}

export async function fetchTradeFlowBookings(branchCode: string): Promise<TradeFlowBooking[]> {
  return getJson(`/v1/tradeflow/bookings?branchCode=${encodeURIComponent(branchCode)}`, "Could not load bookings");
}

export async function createTradeFlowBooking(input: CreateTradeFlowBooking): Promise<TradeFlowBooking> {
  return postJson("/v1/tradeflow/bookings", input, "Could not save booking");
}

export async function fetchTradeFlowInvoices(branchCode: string): Promise<TradeFlowInvoice[]> {
  return getJson(`/v1/tradeflow/invoices?branchCode=${encodeURIComponent(branchCode)}`, "Could not load invoices");
}

export async function fetchTradeFlowInvoice(invoiceId: string): Promise<TradeFlowInvoice> {
  return getJson(`/v1/tradeflow/invoices/${invoiceId}`, "Could not load invoice");
}

export async function createTradeFlowInvoice(input: CreateTradeFlowInvoice): Promise<TradeFlowInvoice> {
  return postJson("/v1/tradeflow/invoices", input, "Could not save invoice");
}

export async function fetchTradeFlowSuppliers(branchCode: string): Promise<TradeFlowSupplier[]> {
  return getJson(`/v1/tradeflow/suppliers?branchCode=${encodeURIComponent(branchCode)}`, "Could not load suppliers");
}

export async function createTradeFlowSupplier(input: CreateTradeFlowSupplier): Promise<TradeFlowSupplier> {
  return postJson("/v1/tradeflow/suppliers", input, "Could not save supplier");
}

export async function updateTradeFlowSupplier(supplierId: string, input: UpdateTradeFlowSupplier): Promise<TradeFlowSupplier> {
  return patchJson(`/v1/tradeflow/suppliers/${supplierId}`, input, "Could not update supplier");
}

export async function fetchTradeFlowPurchases(branchCode: string): Promise<TradeFlowPurchase[]> {
  return getJson(`/v1/tradeflow/purchases?branchCode=${encodeURIComponent(branchCode)}`, "Could not load purchases");
}

export async function createTradeFlowPurchase(input: CreateTradeFlowPurchase): Promise<TradeFlowPurchase> {
  return postJson("/v1/tradeflow/purchases", input, "Could not save purchase");
}

export async function fetchTradeFlowPayments(branchCode: string, partyType?: string, partyId?: string): Promise<TradeFlowPayment[]> {
  const q = new URLSearchParams({ branchCode });
  if (partyType) q.set("partyType", partyType);
  if (partyId) q.set("partyId", partyId);
  return getJson(`/v1/tradeflow/payments?${q}`, "Could not load payments");
}

export async function createTradeFlowPayment(input: CreateTradeFlowPayment): Promise<TradeFlowPayment> {
  return postJson("/v1/tradeflow/payments", input, "Could not save payment");
}

export async function fetchTradeFlowReturns(branchCode: string): Promise<TradeFlowReturn[]> {
  return getJson(`/v1/tradeflow/returns?branchCode=${encodeURIComponent(branchCode)}`, "Could not load returns");
}

export async function createTradeFlowReturn(input: CreateTradeFlowReturn): Promise<TradeFlowReturn> {
  return postJson("/v1/tradeflow/returns", input, "Could not save return");
}

export async function fetchTradeFlowNotes(branchCode: string): Promise<TradeFlowNote[]> {
  return getJson(`/v1/tradeflow/notes?branchCode=${encodeURIComponent(branchCode)}`, "Could not load notes");
}

export async function createTradeFlowNote(input: CreateTradeFlowNote): Promise<TradeFlowNote> {
  return postJson("/v1/tradeflow/notes", input, "Could not save note");
}

export async function fetchTradeFlowAccounts(branchCode: string): Promise<TradeFlowAccount[]> {
  return getJson(`/v1/tradeflow/accounts?branchCode=${encodeURIComponent(branchCode)}`, "Could not load accounts");
}

export async function fetchTradeFlowJournal(branchCode: string): Promise<TradeFlowJournal[]> {
  return getJson(`/v1/tradeflow/journal?branchCode=${encodeURIComponent(branchCode)}`, "Could not load journal");
}

export async function createTradeFlowJournal(input: CreateTradeFlowJournal): Promise<TradeFlowJournal> {
  return postJson("/v1/tradeflow/journal", input, "Could not save journal");
}

export async function fetchTradeFlowContra(branchCode: string): Promise<TradeFlowContra[]> {
  return getJson(`/v1/tradeflow/contra?branchCode=${encodeURIComponent(branchCode)}`, "Could not load contra");
}

export async function createTradeFlowContra(input: CreateTradeFlowContra): Promise<TradeFlowContra> {
  return postJson("/v1/tradeflow/contra", input, "Could not save contra");
}

export async function fetchTradeFlowExpenses(branchCode: string): Promise<TradeFlowExpense[]> {
  return getJson(`/v1/tradeflow/expenses?branchCode=${encodeURIComponent(branchCode)}`, "Could not load expenses");
}

export async function createTradeFlowExpense(input: CreateTradeFlowExpense): Promise<TradeFlowExpense> {
  return postJson("/v1/tradeflow/expenses", input, "Could not save expense");
}

export async function fetchTradeFlowSettings(branchCode: string): Promise<TradeFlowSettings> {
  return getJson(`/v1/tradeflow/settings?branchCode=${encodeURIComponent(branchCode)}`, "Could not load settings");
}

export async function updateTradeFlowSettings(input: UpdateTradeFlowSettings): Promise<TradeFlowSettings> {
  return postJson("/v1/tradeflow/settings", input, "Could not save settings");
}

export async function fetchTradeFlowWhatsapp(params: {
  branchCode: string;
  kind: "invoice" | "reminder" | "purchase";
  partyType: "customer" | "supplier";
  partyId?: string;
  invoiceId?: string;
  purchaseId?: string;
}): Promise<TradeFlowWhatsapp> {
  const q = new URLSearchParams({ branchCode: params.branchCode, kind: params.kind, partyType: params.partyType });
  if (params.partyId) q.set("partyId", params.partyId);
  if (params.invoiceId) q.set("invoiceId", params.invoiceId);
  if (params.purchaseId) q.set("purchaseId", params.purchaseId);
  return getJson(`/v1/tradeflow/whatsapp?${q}`, "Could not prepare WhatsApp");
}
