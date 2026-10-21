import type { PopsNavItem } from "../../pops/spec/modules";

export const mobizoneNavItems: PopsNavItem[] = [
  { type: "link", path: "mobizone/dashboard", label: "Dashboard" },
  { type: "link", path: "mobizone/search", label: "Universal Search" },
  { type: "link", path: "mobizone/legal-record", label: "Legal record" },
  {
    type: "group",
    label: "Trade",
    children: [
      { path: "mobizone/sell", label: "Sell phone" },
      { path: "mobizone/purchase", label: "Buy phone" },
      { path: "mobizone/sale-return", label: "Sale return" },
      { path: "mobizone/purchase-return", label: "Purchase return" },
      { path: "mobizone/sales", label: "Sales history" },
      { path: "mobizone/purchases", label: "Purchase history" },
    ],
  },
  {
    type: "group",
    label: "Stock",
    children: [
      { path: "mobizone/stock", label: "Phone stock" },
      { path: "mobizone/imei", label: "IMEI / barcode" },
      { path: "mobizone/search", label: "Universal Search" },
      { path: "mobizone/legal-record", label: "Legal record" },
    ],
  },
  {
    type: "group",
    label: "People & ledgers",
    children: [
      { path: "mobizone/customers", label: "Customers" },
      { path: "mobizone/shopkeepers", label: "Shopkeepers" },
      { path: "mobizone/ledger", label: "Credit & ledger" },
      { path: "mobizone/payments", label: "Pending payments" },
      { path: "mobizone/legal-record", label: "Legal record" },
    ],
  },
  {
    type: "group",
    label: "Money",
    children: [
      { path: "mobizone/money-ledger?kind=cash", label: "Cash Ledger" },
      { path: "mobizone/banks", label: "Bank accounts" },
      { path: "mobizone/expenses", label: "Create Expense" },
      { path: "mobizone/expense-accounts", label: "Account Expense" },
      { path: "mobizone/contra-voucher", label: "Contra Voucher" },
      { path: "mobizone/general-voucher", label: "General Voucher" },
      { path: "mobizone/business-report", label: "Business report" },
      { path: "mobizone/reports", label: "Sale & purchase" },
      { path: "mobizone/profit", label: "Profit / loss" },
    ],
  },
  { type: "link", path: "mobizone/whatsapp", label: "WhatsApp" },
  { type: "link", path: "mobizone/receipt-settings", label: "Bill print settings" },
  { type: "link", path: "mobizone/google-drive", label: "Google Drive" },
  { type: "link", path: "printer", label: "Receipt printer" },
  { type: "link", path: "sync", label: "Sync & backup" },
  { type: "link", path: "auth", label: "Users & roles" },
  { type: "link", path: "settings", label: "Settings" },
];

export const MOBIZONE_ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full MobiZone access and users",
  manager: "Manager — stock, buy/sell oversight",
  cashier: "Staff — counter buy & sell",
  accountant: "Accountant — payments and reports",
};
