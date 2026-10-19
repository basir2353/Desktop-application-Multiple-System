import type { PopsNavItem } from "../../pops/spec/modules";

export const mobizoneNavItems: PopsNavItem[] = [
  { type: "link", path: "mobizone/dashboard", label: "Dashboard" },
  {
    type: "group",
    label: "Trade",
    children: [
      { path: "mobizone/sell", label: "Sell phone" },
      { path: "mobizone/purchase", label: "Buy phone" },
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
      { path: "mobizone/search", label: "CNIC / IMEI search" },
    ],
  },
  {
    type: "group",
    label: "People & ledgers",
    children: [
      { path: "mobizone/customers", label: "Customers" },
      { path: "mobizone/shopkeepers", label: "Shopkeepers" },
      { path: "mobizone/ledger", label: "Udhaar & ledger" },
      { path: "mobizone/payments", label: "Pending payments" },
    ],
  },
  {
    type: "group",
    label: "Money",
    children: [
      { path: "mobizone/banks", label: "Bank accounts" },
      { path: "mobizone/expenses", label: "Shop expenses" },
      { path: "mobizone/business-report", label: "Business report" },
      { path: "mobizone/reports", label: "Sale & purchase" },
      { path: "mobizone/profit", label: "Profit / loss" },
    ],
  },
  { type: "link", path: "mobizone/whatsapp", label: "WhatsApp" },
  { type: "link", path: "mobizone/receipt-settings", label: "Bill print settings" },
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
