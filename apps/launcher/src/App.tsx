import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { SystemSelectPage } from "./pages/SystemSelectPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { LoginPage } from "./pages/LoginPage";
import { SystemGate } from "./components/SystemGate";
import { useSessionStore } from "./stores/sessionStore";
import { bootstrapSession } from "./lib/authFetch";
import { useSessionReady } from "./hooks/useSessionReady";
import { getRuntimeDb } from "./lib/runtimeDb";
import { BranchGate } from "./pops/components/BranchGate";
import { PopsRootRedirect } from "./pops/components/PopsRootRedirect";
import { PopsShell } from "./pops/layouts/PopsShell";
import { BranchSelectPage } from "./pops/pages/BranchSelectPage";
import { PopsDashboardPage } from "./pops/pages/PopsDashboardPage";
import { AccountingPage } from "./pops/pages/modules/AccountingPage";
import { AccountingAuditLogsPage } from "./pops/pages/modules/accounting/AccountingAuditLogsPage";
import { AccountingReportsPage } from "./pops/pages/modules/accounting/AccountingReportsPage";
import { AccountsPayablePage } from "./pops/pages/modules/accounting/AccountsPayablePage";
import { AccountsReceivablePage } from "./pops/pages/modules/accounting/AccountsReceivablePage";
import { BankAccountsPage } from "./pops/pages/modules/accounting/BankAccountsPage";
import { CashManagementPage } from "./pops/pages/modules/accounting/CashManagementPage";
import { ChartOfAccountsPage } from "./pops/pages/modules/accounting/ChartOfAccountsPage";
import { CustomersPage } from "./pops/pages/modules/accounting/CustomersPage";
import { ExpensesPage } from "./pops/pages/modules/accounting/ExpensesPage";
import { InventoryAccountingPage } from "./pops/pages/modules/accounting/InventoryAccountingPage";
import { JournalEntriesPage } from "./pops/pages/modules/accounting/JournalEntriesPage";
import { PayrollPage } from "./pops/pages/modules/accounting/PayrollPage";
import { PurchasesPage } from "./pops/pages/modules/accounting/PurchasesPage";
import { SalesAccountingPage } from "./pops/pages/modules/accounting/SalesAccountingPage";
import { TaxManagementPage } from "./pops/pages/modules/accounting/TaxManagementPage";
import { VendorsPage } from "./pops/pages/modules/accounting/VendorsPage";
import { AuthPage } from "./pops/pages/modules/AuthPage";
import { ClosingPage } from "./pops/pages/modules/ClosingPage";
import { CrmPage } from "./pops/pages/modules/CrmPage";
import { DeliveryPage } from "./pops/pages/modules/DeliveryPage";
import { HrDashboardPage } from "./pops/pages/modules/hr/HrDashboardPage";
import { EmployeesPage } from "./pops/pages/modules/hr/EmployeesPage";
import { AttendancePage } from "./pops/pages/modules/hr/AttendancePage";
import { LeavePage } from "./pops/pages/modules/hr/LeavePage";
import { HrPayrollPage } from "./pops/pages/modules/hr/HrPayrollPage";
import { SalarySlipsPage } from "./pops/pages/modules/hr/SalarySlipsPage";
import { InventoryAuditLogsPage } from "./pops/pages/modules/inventory/InventoryAuditLogsPage";
import { InventoryDashboardPage } from "./pops/pages/modules/inventory/InventoryDashboardPage";
import { InventoryReportsPage } from "./pops/pages/modules/inventory/InventoryReportsPage";
import { CategoriesPage } from "./pops/pages/modules/inventory/CategoriesPage";
import { GoodsReceivingPage } from "./pops/pages/modules/inventory/GoodsReceivingPage";
import { IngredientsPage } from "./pops/pages/modules/inventory/IngredientsPage";
import { PurchaseOrdersPage } from "./pops/pages/modules/inventory/PurchaseOrdersPage";
import { RecipeManagementPage } from "./pops/pages/modules/inventory/RecipeManagementPage";
import { StockAdjustmentsPage } from "./pops/pages/modules/inventory/StockAdjustmentsPage";
import { StockCountPage } from "./pops/pages/modules/inventory/StockCountPage";
import { StockManagementPage } from "./pops/pages/modules/inventory/StockManagementPage";
import { SuppliersPage } from "./pops/pages/modules/inventory/SuppliersPage";
import { WasteManagementPage } from "./pops/pages/modules/inventory/WasteManagementPage";
import { KitchenPage } from "./pops/pages/modules/KitchenPage";
import { MenuPage } from "./pops/pages/modules/MenuPage";
import { StaffFoodPage } from "./pops/pages/modules/StaffFoodPage";
import { ManufacturingPage } from "./pops/pages/modules/ManufacturingPage";
import { MultiBranchDashboardPage } from "./pops/pages/modules/multi-branch/MultiBranchDashboardPage";
import { InterBranchTransfersPage } from "./pops/pages/modules/multi-branch/InterBranchTransfersPage";
import { BranchReceivePage } from "./pops/pages/modules/multi-branch/BranchReceivePage";
import { BranchPricingPage } from "./pops/pages/modules/multi-branch/BranchPricingPage";
import { ConsolidatedReportsPage } from "./pops/pages/modules/multi-branch/ConsolidatedReportsPage";
import { NotificationsPage } from "./pops/pages/modules/NotificationsPage";
import { NotificationTemplatesPage } from "./pops/pages/modules/notifications/NotificationTemplatesPage";
import { OrdersPage } from "./pops/pages/modules/OrdersPage";
import { PosPage } from "./pops/pages/modules/PosPage";
import { TablesPage } from "./pops/pages/modules/TablesPage";
import { PurchasePage } from "./pops/pages/modules/PurchasePage";
import { ReportsPage } from "./pops/pages/modules/ReportsPage";
import { SecurityPage } from "./pops/pages/modules/SecurityPage";
import { SettingsPage } from "./pops/pages/modules/SettingsPage";
import { SyncPage } from "./pops/pages/modules/SyncPage";
import { TaxPage } from "./pops/pages/modules/TaxPage";
import { WaiterPage } from "./pops/pages/modules/WaiterPage";
import { PharmacyDashboardPage } from "./pharmacy/pages/PharmacyDashboardPage";
import { MedicinesPage } from "./pharmacy/pages/MedicinesPage";
import { PharmacyInventoryPage } from "./pharmacy/pages/PharmacyInventoryPage";
import { PharmacyExpiryPage } from "./pharmacy/pages/PharmacyExpiryPage";
import { PharmacyPosPage } from "./pharmacy/pages/PharmacyPosPage";
import { PrescriptionsPage } from "./pharmacy/pages/PrescriptionsPage";
import { PharmacyCustomersPage } from "./pharmacy/pages/PharmacyCustomersPage";
import { PharmacyDoctorsPage } from "./pharmacy/pages/PharmacyDoctorsPage";
import { PharmacyFinancePage } from "./pharmacy/pages/PharmacyFinancePage";
import { PharmacyReportsPage } from "./pharmacy/pages/PharmacyReportsPage";
import { PharmacyStaffPanelPage } from "./pharmacy/pages/PharmacyStaffPanelPage";
import { PharmacyAdminPanelPage } from "./pharmacy/pages/PharmacyAdminPanelPage";
import { PharmacySuppliersPage } from "./pharmacy/pages/PharmacySuppliersPage";
import { PharmacyStaffPage } from "./pharmacy/pages/PharmacyStaffPage";
import { PharmacyRackMapPage } from "./pharmacy/pages/PharmacyRackMapPage";
import {
  PharmacyPurchaseStatementPage,
  PharmacySupplierPaymentsPage,
  PharmacySalesManagementPage,
  PharmacySalesStatementPage,
  PharmacyProfitLossPage,
  PharmacySalesMonthPage,
  PharmacyExpiredProductsPage,
} from "./pharmacy/pages/PharmacyFeaturePages";
import {
  PharmacyControlledDrugsPage,
  PharmacyKhataPage,
  PharmacyRefillRemindersPage,
  PharmacyShiftPage,
  PharmacyTaxCompliancePage,
} from "./pharmacy/pages/PharmacyExtendedPages";
import { StoreDashboardPage } from "./store/pages/StoreDashboardPage";
import { StoreProductsPage } from "./store/pages/StoreProductsPage";
import { StoreCategoriesPage } from "./store/pages/StoreCategoriesPage";
import { StoreInventoryPage } from "./store/pages/StoreInventoryPage";
import { StoreStockMovementPage } from "./store/pages/StoreStockMovementPage";
import { StoreBatchesPage, StoreBarcodePage } from "./store/pages/StoreBatchesPage";
import { StorePosPage } from "./store/pages/StorePosPage";
import { StorePromotionsPage, StoreShiftPage, StoreShortcutsPage } from "./store/pages/StoreExtendedPages";
import { StoreCustomerDisplayPage } from "./store/pages/StoreCustomerDisplayPage";
import { StorePriceCheckerPage } from "./store/pages/StorePriceCheckerPage";
import {
  StoreCouponsPage,
  StoreEmployeeReportPage,
  StoreGiftCardsPage,
  StorePeakHoursPage,
  StorePurchaseReturnsPage,
  StoreReturnsPage,
  StoreWastageReportPage,
} from "./store/pages/StoreGroceryPages";
import { StoreSuppliersPage } from "./store/pages/StoreSuppliersPage";
import { StoreCustomersPage, StoreSalesPage } from "./store/pages/StoreCustomersPage";
import { StoreWarehousesPage, StoreTransfersPage, StoreAdjustmentsPage, StoreAuditsPage } from "./store/pages/StoreWarehousePages";
import { StorePurchaseRequisitionsPage, StorePurchaseOrdersPage, StoreGrnPage } from "./store/pages/StorePurchasePages";
import { StoreReportsPage, StoreStockReportPage, StoreProfitLossPage, StoreInventoryValuationPage } from "./store/pages/StoreReportsPage";
import { HistoryNavBar } from "./components/HistoryNavBar";
import { NavigationHistoryProvider } from "./hooks/useNavigationHistory";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { screenCenterClass } from "./pops/lib/themeClasses";

function Protected({ children }: { children: JSX.Element }): JSX.Element {
  const sessionReady = useSessionReady();
  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    if (sessionReady) void bootstrapSession();
  }, [sessionReady]);

  if (!sessionReady) {
    return <div className={screenCenterClass}>Restoring session…</div>;
  }
  if (!accessToken) return <Navigate to="/login" replace />;
  return children;
}

export function App(): JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getRuntimeDb()
      .then(() => setReady(true))
      .catch((e) => {
        console.error(e);
        setReady(true);
      });
  }, []);

  if (!ready) {
    return <div className={screenCenterClass}>Initializing local database…</div>;
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <NavigationHistoryProvider>
        <>
          <HistoryNavBar />
          <RootErrorBoundary>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/" element={<SystemSelectPage />} />
          <Route
            path="/platform"
            element={
              <Protected>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/pops"
            element={
              <Protected>
                <SystemGate />
              </Protected>
            }
          >
            <Route index element={<PopsRootRedirect />} />
            <Route path="branches" element={<BranchSelectPage />} />
            <Route element={<BranchGate />}>
              <Route element={<PopsShell />}>
                <Route path="dashboard" element={<PopsDashboardPage />} />
                <Route path="auth" element={<AuthPage />} />
                <Route path="menu" element={<MenuPage />} />
                <Route path="staff-food" element={<StaffFoodPage />} />
                <Route path="pos" element={<PosPage />} />
                <Route path="tables" element={<TablesPage />} />
                <Route path="orders" element={<OrdersPage />} />
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
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="notifications/templates" element={<NotificationTemplatesPage />} />
                <Route path="manufacturing" element={<ManufacturingPage />} />
                <Route path="security" element={<SecurityPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="closing" element={<ClosingPage />} />
                <Route path="pharmacy/dashboard" element={<PharmacyDashboardPage />} />
                <Route path="pharmacy/medicines" element={<MedicinesPage />} />
                <Route path="pharmacy/rack-map" element={<PharmacyRackMapPage />} />
                <Route path="pharmacy/inventory" element={<PharmacyInventoryPage />} />
                <Route path="pharmacy/expiry" element={<PharmacyExpiryPage />} />
                <Route path="pharmacy/pos" element={<PharmacyPosPage />} />
                <Route path="pharmacy/prescriptions" element={<PrescriptionsPage />} />
                <Route path="pharmacy/customers" element={<PharmacyCustomersPage />} />
                <Route path="pharmacy/doctors" element={<PharmacyDoctorsPage />} />
                <Route path="pharmacy/finance" element={<PharmacyFinancePage />} />
                <Route path="pharmacy/reports" element={<PharmacyReportsPage />} />
                <Route path="pharmacy/staff-panel" element={<PharmacyStaffPanelPage />} />
                <Route path="pharmacy/admin-panel" element={<PharmacyAdminPanelPage />} />
                <Route path="pharmacy/suppliers" element={<PharmacySuppliersPage />} />
                <Route path="pharmacy/staff" element={<PharmacyStaffPage />} />
                <Route path="pharmacy/purchase-statement" element={<PharmacyPurchaseStatementPage />} />
                <Route path="pharmacy/supplier-payments" element={<PharmacySupplierPaymentsPage />} />
                <Route path="pharmacy/sales" element={<PharmacySalesManagementPage />} />
                <Route path="pharmacy/sales-statement" element={<PharmacySalesStatementPage />} />
                <Route path="pharmacy/sales-month" element={<PharmacySalesMonthPage />} />
                <Route path="pharmacy/profit-loss" element={<PharmacyProfitLossPage />} />
                <Route path="pharmacy/expired" element={<PharmacyExpiredProductsPage />} />
                <Route path="pharmacy/khata" element={<PharmacyKhataPage />} />
                <Route path="pharmacy/shifts" element={<PharmacyShiftPage />} />
                <Route path="pharmacy/controlled-drugs" element={<PharmacyControlledDrugsPage />} />
                <Route path="pharmacy/refill-reminders" element={<PharmacyRefillRemindersPage />} />
                <Route path="pharmacy/tax-compliance" element={<PharmacyTaxCompliancePage />} />
                <Route path="store/dashboard" element={<StoreDashboardPage />} />
                <Route path="store/products" element={<StoreProductsPage />} />
                <Route path="store/categories" element={<StoreCategoriesPage />} />
                <Route path="store/inventory" element={<StoreInventoryPage />} />
                <Route path="store/stock-movement" element={<StoreStockMovementPage />} />
                <Route path="store/batches" element={<StoreBatchesPage />} />
                <Route path="store/barcode" element={<StoreBarcodePage />} />
                <Route path="store/pos" element={<StorePosPage />} />
                <Route path="store/shifts" element={<StoreShiftPage />} />
                <Route path="store/promotions" element={<StorePromotionsPage />} />
                <Route path="store/shortcuts" element={<StoreShortcutsPage />} />
                <Route path="store/customer-display" element={<StoreCustomerDisplayPage />} />
                <Route path="store/price-checker" element={<StorePriceCheckerPage />} />
                <Route path="store/coupons" element={<StoreCouponsPage />} />
                <Route path="store/gift-cards" element={<StoreGiftCardsPage />} />
                <Route path="store/returns" element={<StoreReturnsPage />} />
                <Route path="store/purchase/returns" element={<StorePurchaseReturnsPage />} />
                <Route path="store/reports/peak-hours" element={<StorePeakHoursPage />} />
                <Route path="store/reports/employees" element={<StoreEmployeeReportPage />} />
                <Route path="store/reports/wastage" element={<StoreWastageReportPage />} />
                <Route path="store/suppliers" element={<StoreSuppliersPage />} />
                <Route path="store/customers" element={<StoreCustomersPage />} />
                <Route path="store/sales" element={<StoreSalesPage />} />
                <Route path="store/warehouses" element={<StoreWarehousesPage />} />
                <Route path="store/transfers" element={<StoreTransfersPage />} />
                <Route path="store/adjustments" element={<StoreAdjustmentsPage />} />
                <Route path="store/audits" element={<StoreAuditsPage />} />
                <Route path="store/purchase/requisitions" element={<StorePurchaseRequisitionsPage />} />
                <Route path="store/purchase/orders" element={<StorePurchaseOrdersPage />} />
                <Route path="store/purchase/grn" element={<StoreGrnPage />} />
                <Route path="store/reports" element={<StoreReportsPage />} />
                <Route path="store/reports/stock" element={<StoreStockReportPage />} />
                <Route path="store/reports/profit-loss" element={<StoreProfitLossPage />} />
                <Route path="store/reports/inventory" element={<StoreInventoryValuationPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </RootErrorBoundary>
        </>
        </NavigationHistoryProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
