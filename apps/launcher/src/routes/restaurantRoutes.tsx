import { Route } from "react-router-dom";
import { lazy } from "react";

// Restaurant (POPS) — restaurant-exclusive + shared ERP screens.
const PopsDashboardPage = lazy(() =>
  import("../pops/pages/PopsDashboardPage").then((m) => ({ default: m.PopsDashboardPage })),
);
const MenuPage = lazy(() => import("../pops/pages/modules/MenuPage").then((m) => ({ default: m.MenuPage })));
const PosPage = lazy(() => import("../pops/pages/modules/PosPage").then((m) => ({ default: m.PosPage })));
const CashDrawerPage = lazy(() =>
  import("../pops/pages/modules/CashDrawerPage").then((m) => ({ default: m.CashDrawerPage })),
);
const TablesPage = lazy(() => import("../pops/pages/modules/TablesPage").then((m) => ({ default: m.TablesPage })));
const BillManagementPage = lazy(() =>
  import("../pops/pages/modules/BillManagementPage").then((m) => ({ default: m.BillManagementPage })),
);
const OrdersPage = lazy(() => import("../pops/pages/modules/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const KitchenPage = lazy(() => import("../pops/pages/modules/KitchenPage").then((m) => ({ default: m.KitchenPage })));
const WaiterPage = lazy(() => import("../pops/pages/modules/WaiterPage").then((m) => ({ default: m.WaiterPage })));
const InventoryDashboardPage = lazy(() =>
  import("../pops/pages/modules/inventory/InventoryDashboardPage").then((m) => ({ default: m.InventoryDashboardPage })),
);
const IngredientsPage = lazy(() =>
  import("../pops/pages/modules/inventory/IngredientsPage").then((m) => ({ default: m.IngredientsPage })),
);
const CategoriesPage = lazy(() =>
  import("../pops/pages/modules/inventory/CategoriesPage").then((m) => ({ default: m.CategoriesPage })),
);
const SuppliersPage = lazy(() =>
  import("../pops/pages/modules/inventory/SuppliersPage").then((m) => ({ default: m.SuppliersPage })),
);
const PurchaseOrdersPage = lazy(() =>
  import("../pops/pages/modules/inventory/PurchaseOrdersPage").then((m) => ({ default: m.PurchaseOrdersPage })),
);
const GoodsReceivingPage = lazy(() =>
  import("../pops/pages/modules/inventory/GoodsReceivingPage").then((m) => ({ default: m.GoodsReceivingPage })),
);
const StockManagementPage = lazy(() =>
  import("../pops/pages/modules/inventory/StockManagementPage").then((m) => ({ default: m.StockManagementPage })),
);
const RecipeManagementPage = lazy(() =>
  import("../pops/pages/modules/inventory/RecipeManagementPage").then((m) => ({ default: m.RecipeManagementPage })),
);
const StockAdjustmentsPage = lazy(() =>
  import("../pops/pages/modules/inventory/StockAdjustmentsPage").then((m) => ({ default: m.StockAdjustmentsPage })),
);
const WasteManagementPage = lazy(() =>
  import("../pops/pages/modules/inventory/WasteManagementPage").then((m) => ({ default: m.WasteManagementPage })),
);
const StockCountPage = lazy(() =>
  import("../pops/pages/modules/inventory/StockCountPage").then((m) => ({ default: m.StockCountPage })),
);
const InventoryReportsPage = lazy(() =>
  import("../pops/pages/modules/inventory/InventoryReportsPage").then((m) => ({ default: m.InventoryReportsPage })),
);
const InventoryAuditLogsPage = lazy(() =>
  import("../pops/pages/modules/inventory/InventoryAuditLogsPage").then((m) => ({ default: m.InventoryAuditLogsPage })),
);
const PurchasePage = lazy(() =>
  import("../pops/pages/modules/PurchasePage").then((m) => ({ default: m.PurchasePage })),
);
const AccountingPage = lazy(() =>
  import("../pops/pages/modules/AccountingPage").then((m) => ({ default: m.AccountingPage })),
);
const SalesAccountingPage = lazy(() =>
  import("../pops/pages/modules/accounting/SalesAccountingPage").then((m) => ({ default: m.SalesAccountingPage })),
);
const ExpensesPage = lazy(() =>
  import("../pops/pages/modules/accounting/ExpensesPage").then((m) => ({ default: m.ExpensesPage })),
);
const PurchasesPage = lazy(() =>
  import("../pops/pages/modules/accounting/PurchasesPage").then((m) => ({ default: m.PurchasesPage })),
);
const VendorsPage = lazy(() =>
  import("../pops/pages/modules/accounting/VendorsPage").then((m) => ({ default: m.VendorsPage })),
);
const CustomersPage = lazy(() =>
  import("../pops/pages/modules/accounting/CustomersPage").then((m) => ({ default: m.CustomersPage })),
);
const InventoryAccountingPage = lazy(() =>
  import("../pops/pages/modules/accounting/InventoryAccountingPage").then((m) => ({ default: m.InventoryAccountingPage })),
);
const PayrollPage = lazy(() =>
  import("../pops/pages/modules/accounting/PayrollPage").then((m) => ({ default: m.PayrollPage })),
);
const CashManagementPage = lazy(() =>
  import("../pops/pages/modules/accounting/CashManagementPage").then((m) => ({ default: m.CashManagementPage })),
);
const BankAccountsPage = lazy(() =>
  import("../pops/pages/modules/accounting/BankAccountsPage").then((m) => ({ default: m.BankAccountsPage })),
);
const AccountsReceivablePage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountsReceivablePage").then((m) => ({ default: m.AccountsReceivablePage })),
);
const AccountsPayablePage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountsPayablePage").then((m) => ({ default: m.AccountsPayablePage })),
);
const JournalEntriesPage = lazy(() =>
  import("../pops/pages/modules/accounting/JournalEntriesPage").then((m) => ({ default: m.JournalEntriesPage })),
);
const TaxManagementPage = lazy(() =>
  import("../pops/pages/modules/accounting/TaxManagementPage").then((m) => ({ default: m.TaxManagementPage })),
);
const AccountingReportsPage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountingReportsPage").then((m) => ({ default: m.AccountingReportsPage })),
);
const ChartOfAccountsPage = lazy(() =>
  import("../pops/pages/modules/accounting/ChartOfAccountsPage").then((m) => ({ default: m.ChartOfAccountsPage })),
);
const AccountingAuditLogsPage = lazy(() =>
  import("../pops/pages/modules/accounting/AccountingAuditLogsPage").then((m) => ({ default: m.AccountingAuditLogsPage })),
);
const HrDashboardPage = lazy(() =>
  import("../pops/pages/modules/hr/HrDashboardPage").then((m) => ({ default: m.HrDashboardPage })),
);
const EmployeesPage = lazy(() =>
  import("../pops/pages/modules/hr/EmployeesPage").then((m) => ({ default: m.EmployeesPage })),
);
const AttendancePage = lazy(() =>
  import("../pops/pages/modules/hr/AttendancePage").then((m) => ({ default: m.AttendancePage })),
);
const LeavePage = lazy(() => import("../pops/pages/modules/hr/LeavePage").then((m) => ({ default: m.LeavePage })));
const HrPayrollPage = lazy(() =>
  import("../pops/pages/modules/hr/HrPayrollPage").then((m) => ({ default: m.HrPayrollPage })),
);
const SalarySlipsPage = lazy(() =>
  import("../pops/pages/modules/hr/SalarySlipsPage").then((m) => ({ default: m.SalarySlipsPage })),
);
const DeliveryPage = lazy(() =>
  import("../pops/pages/modules/DeliveryPage").then((m) => ({ default: m.DeliveryPage })),
);
const CrmPage = lazy(() => import("../pops/pages/modules/CrmPage").then((m) => ({ default: m.CrmPage })));
const TaxPage = lazy(() => import("../pops/pages/modules/TaxPage").then((m) => ({ default: m.TaxPage })));
const MultiBranchDashboardPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/MultiBranchDashboardPage").then((m) => ({ default: m.MultiBranchDashboardPage })),
);
const InterBranchTransfersPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/InterBranchTransfersPage").then((m) => ({ default: m.InterBranchTransfersPage })),
);
const BranchReceivePage = lazy(() =>
  import("../pops/pages/modules/multi-branch/BranchReceivePage").then((m) => ({ default: m.BranchReceivePage })),
);
const BranchPricingPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/BranchPricingPage").then((m) => ({ default: m.BranchPricingPage })),
);
const ConsolidatedReportsPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/ConsolidatedReportsPage").then((m) => ({ default: m.ConsolidatedReportsPage })),
);
const SyncPage = lazy(() => import("../pops/pages/modules/SyncPage").then((m) => ({ default: m.SyncPage })));
const ReportsPage = lazy(() => import("../pops/pages/modules/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const ManufacturingPage = lazy(() =>
  import("../pops/pages/modules/ManufacturingPage").then((m) => ({ default: m.ManufacturingPage })),
);
const ContentPage = lazy(() =>
  import("../pops/pages/modules/ContentPage").then((m) => ({ default: m.ContentPage })),
);

/** Restaurant-exclusive routes. Rendered only in restaurant or suite editions. */
export function restaurantRoutes(): JSX.Element {
  return (
    <>
      <Route path="dashboard" element={<PopsDashboardPage />} />
      <Route path="menu" element={<MenuPage />} />
      <Route path="pos" element={<PosPage />} />
      <Route path="pos/cash-drawer" element={<CashDrawerPage />} />
      <Route path="tables" element={<TablesPage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="bills" element={<BillManagementPage />} />
      <Route path="kitchen" element={<KitchenPage />} />
      <Route path="waiter" element={<WaiterPage />} />
      <Route path="inventory" element={<InventoryDashboardPage />} />
      <Route path="inventory/ingredients" element={<IngredientsPage />} />
      <Route path="inventory/categories" element={<CategoriesPage />} />
      <Route path="inventory/suppliers" element={<SuppliersPage />} />
      <Route path="inventory/purchase-orders" element={<PurchaseOrdersPage />} />
      <Route path="inventory/goods-receiving" element={<GoodsReceivingPage />} />
      <Route path="inventory/stock" element={<StockManagementPage />} />
      <Route path="inventory/recipes" element={<RecipeManagementPage />} />
      <Route path="inventory/adjustments" element={<StockAdjustmentsPage />} />
      <Route path="inventory/waste" element={<WasteManagementPage />} />
      <Route path="inventory/stock-count" element={<StockCountPage />} />
      <Route path="inventory/reports" element={<InventoryReportsPage />} />
      <Route path="inventory/audit-logs" element={<InventoryAuditLogsPage />} />
      <Route path="purchase" element={<PurchasePage />} />
      <Route path="accounting" element={<AccountingPage />} />
      <Route path="accounting/sales" element={<SalesAccountingPage />} />
      <Route path="accounting/expenses" element={<ExpensesPage />} />
      <Route path="accounting/purchases" element={<PurchasesPage />} />
      <Route path="accounting/vendors" element={<VendorsPage />} />
      <Route path="accounting/customers" element={<CustomersPage />} />
      <Route path="accounting/inventory" element={<InventoryAccountingPage />} />
      <Route path="accounting/payroll" element={<PayrollPage />} />
      <Route path="accounting/cash" element={<CashManagementPage />} />
      <Route path="accounting/bank" element={<BankAccountsPage />} />
      <Route path="accounting/receivable" element={<AccountsReceivablePage />} />
      <Route path="accounting/payable" element={<AccountsPayablePage />} />
      <Route path="accounting/journal" element={<JournalEntriesPage />} />
      <Route path="accounting/tax" element={<TaxManagementPage />} />
      <Route path="accounting/reports" element={<AccountingReportsPage />} />
      <Route path="accounting/accounts" element={<ChartOfAccountsPage />} />
      <Route path="accounting/audit-logs" element={<AccountingAuditLogsPage />} />
      <Route path="hr" element={<HrDashboardPage />} />
      <Route path="hr/employees" element={<EmployeesPage />} />
      <Route path="hr/attendance" element={<AttendancePage />} />
      <Route path="hr/leave" element={<LeavePage />} />
      <Route path="hr/payroll" element={<HrPayrollPage />} />
      <Route path="hr/salary-slips" element={<SalarySlipsPage />} />
      <Route path="delivery" element={<DeliveryPage />} />
      <Route path="crm" element={<CrmPage />} />
      <Route path="tax" element={<TaxPage />} />
      <Route path="multi-branch" element={<MultiBranchDashboardPage />} />
      <Route path="multi-branch/transfers" element={<InterBranchTransfersPage />} />
      <Route path="multi-branch/receive" element={<BranchReceivePage />} />
      <Route path="multi-branch/pricing" element={<BranchPricingPage />} />
      <Route path="multi-branch/reports" element={<ConsolidatedReportsPage />} />
      <Route path="sync" element={<SyncPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="manufacturing" element={<ManufacturingPage />} />
      <Route path="content" element={<ContentPage />} />
    </>
  );
}
