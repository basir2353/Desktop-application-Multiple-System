import type { PopsNavItem } from "../../pops/spec/modules";

export const tradeflowNavItems: PopsNavItem[] = [
  { type: "link", path: "tradeflow/dashboard", label: "Dashboard" },
  {
    type: "group",
    label: "Sales",
    children: [
      { path: "tradeflow/pos", label: "POS" },
      { path: "tradeflow/invoices", label: "Invoices" },
      { path: "tradeflow/bookings", label: "Bookings" },
    ],
  },
  {
    type: "group",
    label: "Parties",
    children: [
      { path: "tradeflow/customers", label: "Parties" },
      { path: "tradeflow/ledger", label: "Ledger" },
      { path: "tradeflow/payments", label: "Payments" },
    ],
  },
  {
    type: "group",
    label: "Inventory",
    children: [
      { path: "tradeflow/items", label: "Items" },
      { path: "tradeflow/stock", label: "Stock" },
    ],
  },
  {
    type: "group",
    label: "Purchases",
    children: [
      { path: "tradeflow/purchases", label: "Purchase invoices" },
      { path: "tradeflow/returns", label: "Returns" },
    ],
  },
  {
    type: "group",
    label: "Accounting",
    children: [
      { path: "tradeflow/notes", label: "Credit / Debit" },
      { path: "tradeflow/journal", label: "Journal" },
      { path: "tradeflow/contra", label: "Contra" },
    ],
  },
  { type: "link", path: "tradeflow/settings", label: "WhatsApp" },
  {
    type: "group",
    label: "Operations",
    children: [
      { path: "tradeflow/mobile", label: "Mobile" },
      { path: "printer", label: "Printer" },
    ],
  },
  { type: "link", path: "auth", label: "Users & roles" },
  { type: "link", path: "settings", label: "Settings" },
];

export const TRADEFLOW_ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full MaterialFlow access and users",
  manager: "Manager — operations oversight",
  cashier: "Staff — day-to-day trade work",
  accountant: "Accountant — ledgers and reports",
};
