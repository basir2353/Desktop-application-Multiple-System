/** Navigation labels for POPS — routes map to real screens under `pages/modules/`. */

export type PopsNavLink = { type: "link"; path: string; label: string };

export type PopsNavGroup = {
  type: "group";
  label: string;
  children: { path: string; label: string }[];
};

export type PopsNavItem = PopsNavLink | PopsNavGroup;

export const popsNavItems: PopsNavItem[] = [
  { type: "link", path: "dashboard", label: "Dashboard" },
  { type: "link", path: "auth", label: "Users & access" },
  { type: "link", path: "menu", label: "Menu" },
  {
    type: "group",
    label: "POS",
    children: [
      { path: "pos", label: "POS" },
      { path: "pos/cash-drawer", label: "Cash drawer" },
      { path: "waiter", label: "Waiter" },
      { path: "tables", label: "Tables" },
      { path: "orders", label: "Orders" },
      { path: "bills", label: "Bill management" },
      { path: "kitchen", label: "Kitchen" },
      { path: "delivery", label: "Delivery" },
    ],
  },
  {
    type: "group",
    label: "Inventory",
    children: [
      { path: "inventory", label: "Dashboard" },
      { path: "inventory/ingredients", label: "Ingredients" },
      { path: "inventory/categories", label: "Categories" },
      { path: "inventory/suppliers", label: "Suppliers" },
      { path: "inventory/purchase-orders", label: "Kitchen demand" },
      { path: "inventory/goods-receiving", label: "Goods receiving" },
      { path: "inventory/stock", label: "Stock management" },
      { path: "inventory/recipes", label: "Recipe management" },
      { path: "inventory/adjustments", label: "Stock adjustments" },
      { path: "inventory/waste", label: "Waste management" },
      { path: "inventory/stock-count", label: "Stock count" },
      { path: "inventory/reports", label: "Reports" },
      { path: "inventory/audit-logs", label: "Audit logs" },
    ],
  },
  { type: "link", path: "purchase", label: "Purchase" },
  {
    type: "group",
    label: "Accounting",
    children: [
      { path: "accounting", label: "Dashboard" },
      { path: "accounting/sales", label: "Sales" },
      { path: "accounting/expenses", label: "Expenses" },
      { path: "accounting/purchases", label: "Purchases" },
      { path: "accounting/vendors", label: "Vendors" },
      { path: "accounting/customers", label: "Customers" },
      { path: "accounting/inventory", label: "Inventory accounting" },
      { path: "accounting/payroll", label: "Payroll" },
      { path: "accounting/cash", label: "Cash management" },
      { path: "accounting/bank", label: "Bank accounts" },
      { path: "accounting/receivable", label: "Accounts receivable" },
      { path: "accounting/payable", label: "Accounts payable" },
      { path: "accounting/journal", label: "Journal entries" },
      { path: "accounting/tax", label: "Tax management" },
      { path: "accounting/reports", label: "Reports" },
      { path: "accounting/accounts", label: "Chart of accounts" },
      { path: "accounting/audit-logs", label: "Audit logs" },
    ],
  },
  {
    type: "group",
    label: "HR & payroll",
    children: [
      { path: "hr", label: "Dashboard" },
      { path: "hr/employees", label: "Employees" },
      { path: "hr/attendance", label: "Attendance" },
      { path: "hr/leave", label: "Leave" },
      { path: "hr/payroll", label: "Payroll runs" },
      { path: "hr/salary-slips", label: "Salary slips" },
    ],
  },
  { type: "link", path: "tax", label: "FBR / PRA" },
  {
    type: "group",
    label: "Multi-branch",
    children: [
      { path: "multi-branch", label: "Overview" },
      { path: "multi-branch/transfers", label: "Transfers" },
      { path: "multi-branch/receive", label: "Receive" },
      { path: "multi-branch/pricing", label: "Branch pricing" },
      { path: "multi-branch/reports", label: "Consolidated report" },
    ],
  },
  { type: "link", path: "sync", label: "Sync & backup" },
  {
    type: "group",
    label: "Reports",
    children: [
      { path: "reports", label: "Overview" },
      { path: "reports/sales-by-item", label: "Sales by item" },
      { path: "reports/cashier-out", label: "Cashier out" },
      { path: "reports/cash-report", label: "Cash Report" },
      { path: "reports/sales-by-kitchen", label: "Sales by kitchen" },
      { path: "reports/sales-by-employee", label: "Sales by employee" },
      { path: "reports/sales-by-order-type", label: "Sales by order type" },
      { path: "reports/delivery", label: "Delivery report" },
      { path: "reports/discount", label: "Discount report" },
      { path: "reports/canceled-orders", label: "Canceled orders" },
      { path: "reports/item-remove", label: "Item remove" },
      { path: "reports/cashier-overshort", label: "Cashier over/short" },
      { path: "reports/profit-loss", label: "Profit & loss" },
      { path: "reports/expense", label: "Expense report" },
      { path: "reports/sales-by-hall", label: "Sales by hall" },
      { path: "reports/cash-drawer", label: "Cash drawer" },
      { path: "reports/kitchen-printing-logs", label: "Kitchen printing logs" },
      { path: "reports/kitchen-missing-log", label: "Kitchen missing log" },
      { path: "reports/table-server-change", label: "Table server change" },
      { path: "reports/customer-ledger", label: "Customer ledger" },
      { path: "reports/employee-ledger", label: "Employees ledger" },
      { path: "reports/vendor-ledger", label: "Vendor ledger" },
      { path: "reports/vendors-balance", label: "Vendors with balance" },
      { path: "reports/ingredients-usage", label: "Ingredients usage" },
      { path: "reports/ingredients-stock", label: "Ingredients stock" },
      { path: "reports/kitchen-cancellations", label: "Kitchen cancellations" },
    ],
  },
  {
    type: "group",
    label: "Notifications",
    children: [
      { path: "notifications", label: "Overview" },
      { path: "notifications/templates", label: "Templates" },
    ],
  },
  { type: "link", path: "manufacturing", label: "Production" },
  { type: "link", path: "content", label: "Content Updation" },
  { type: "link", path: "security", label: "Security" },
  { type: "link", path: "settings", label: "Settings" },
  { type: "link", path: "printer", label: "Printer" },
  { type: "link", path: "closing", label: "Closing" },
];

/** Flat links for dashboards and other lists that need every route. */
export function flattenPopsNavLinks(): { path: string; label: string }[] {
  const out: { path: string; label: string }[] = [];
  for (const item of popsNavItems) {
    if (item.type === "link") {
      out.push({ path: item.path, label: item.label });
    } else {
      out.push(...item.children);
    }
  }
  return out;
}

export const dashboardSections: string[] = [
  "Live sales",
  "Branch monitoring",
  "Active orders",
  "Inventory alerts",
  "Staff attendance",
  "Delivery tracking",
  "Revenue analytics",
  "Expense overview",
  "Customer statistics",
  "Top products",
  "Tax summary",
  "Profit analysis",
];
