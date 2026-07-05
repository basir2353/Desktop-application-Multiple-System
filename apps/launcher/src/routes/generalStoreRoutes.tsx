import { Route } from "react-router-dom";
import { lazy } from "react";

// General Store / Retail — rendered only in general-store or suite editions.
const StoreDashboardPage = lazy(() =>
  import("../store/pages/StoreDashboardPage").then((m) => ({ default: m.StoreDashboardPage })),
);
const StoreProductsPage = lazy(() =>
  import("../store/pages/StoreProductsPage").then((m) => ({ default: m.StoreProductsPage })),
);
const StoreCategoriesPage = lazy(() =>
  import("../store/pages/StoreCategoriesPage").then((m) => ({ default: m.StoreCategoriesPage })),
);
const StoreInventoryPage = lazy(() =>
  import("../store/pages/StoreInventoryPage").then((m) => ({ default: m.StoreInventoryPage })),
);
const StoreStockMovementPage = lazy(() =>
  import("../store/pages/StoreStockMovementPage").then((m) => ({ default: m.StoreStockMovementPage })),
);
const StoreBatchesPage = lazy(() =>
  import("../store/pages/StoreBatchesPage").then((m) => ({ default: m.StoreBatchesPage })),
);
const StoreBarcodePage = lazy(() =>
  import("../store/pages/StoreBatchesPage").then((m) => ({ default: m.StoreBarcodePage })),
);
const StorePosPage = lazy(() =>
  import("../store/pages/StorePosPage").then((m) => ({ default: m.StorePosPage })),
);
const StorePromotionsPage = lazy(() =>
  import("../store/pages/StoreExtendedPages").then((m) => ({ default: m.StorePromotionsPage })),
);
const StoreShiftPage = lazy(() =>
  import("../store/pages/StoreExtendedPages").then((m) => ({ default: m.StoreShiftPage })),
);
const StoreShortcutsPage = lazy(() =>
  import("../store/pages/StoreExtendedPages").then((m) => ({ default: m.StoreShortcutsPage })),
);
const StoreCustomerDisplayPage = lazy(() =>
  import("../store/pages/StoreCustomerDisplayPage").then((m) => ({ default: m.StoreCustomerDisplayPage })),
);
const StorePriceCheckerPage = lazy(() =>
  import("../store/pages/StorePriceCheckerPage").then((m) => ({ default: m.StorePriceCheckerPage })),
);
const StoreCouponsPage = lazy(() =>
  import("../store/pages/StoreGroceryPages").then((m) => ({ default: m.StoreCouponsPage })),
);
const StoreEmployeeReportPage = lazy(() =>
  import("../store/pages/StoreGroceryPages").then((m) => ({ default: m.StoreEmployeeReportPage })),
);
const StoreGiftCardsPage = lazy(() =>
  import("../store/pages/StoreGroceryPages").then((m) => ({ default: m.StoreGiftCardsPage })),
);
const StorePeakHoursPage = lazy(() =>
  import("../store/pages/StoreGroceryPages").then((m) => ({ default: m.StorePeakHoursPage })),
);
const StorePurchaseReturnsPage = lazy(() =>
  import("../store/pages/StoreGroceryPages").then((m) => ({ default: m.StorePurchaseReturnsPage })),
);
const StoreReturnsPage = lazy(() =>
  import("../store/pages/StoreGroceryPages").then((m) => ({ default: m.StoreReturnsPage })),
);
const StoreWastageReportPage = lazy(() =>
  import("../store/pages/StoreGroceryPages").then((m) => ({ default: m.StoreWastageReportPage })),
);
const StoreSuppliersPage = lazy(() =>
  import("../store/pages/StoreSuppliersPage").then((m) => ({ default: m.StoreSuppliersPage })),
);
const StoreCustomersPage = lazy(() =>
  import("../store/pages/StoreCustomersPage").then((m) => ({ default: m.StoreCustomersPage })),
);
const StoreSalesPage = lazy(() =>
  import("../store/pages/StoreCustomersPage").then((m) => ({ default: m.StoreSalesPage })),
);
const StoreWarehousesPage = lazy(() =>
  import("../store/pages/StoreWarehousePages").then((m) => ({ default: m.StoreWarehousesPage })),
);
const StoreTransfersPage = lazy(() =>
  import("../store/pages/StoreWarehousePages").then((m) => ({ default: m.StoreTransfersPage })),
);
const StoreAdjustmentsPage = lazy(() =>
  import("../store/pages/StoreWarehousePages").then((m) => ({ default: m.StoreAdjustmentsPage })),
);
const StoreAuditsPage = lazy(() =>
  import("../store/pages/StoreWarehousePages").then((m) => ({ default: m.StoreAuditsPage })),
);
const StorePurchaseRequisitionsPage = lazy(() =>
  import("../store/pages/StorePurchasePages").then((m) => ({ default: m.StorePurchaseRequisitionsPage })),
);
const StorePurchaseOrdersPage = lazy(() =>
  import("../store/pages/StorePurchasePages").then((m) => ({ default: m.StorePurchaseOrdersPage })),
);
const StoreGrnPage = lazy(() =>
  import("../store/pages/StorePurchasePages").then((m) => ({ default: m.StoreGrnPage })),
);
const StoreReportsPage = lazy(() =>
  import("../store/pages/StoreReportsPage").then((m) => ({ default: m.StoreReportsPage })),
);
const StoreStockReportPage = lazy(() =>
  import("../store/pages/StoreReportsPage").then((m) => ({ default: m.StoreStockReportPage })),
);
const StoreProfitLossPage = lazy(() =>
  import("../store/pages/StoreReportsPage").then((m) => ({ default: m.StoreProfitLossPage })),
);
const StoreInventoryValuationPage = lazy(() =>
  import("../store/pages/StoreReportsPage").then((m) => ({ default: m.StoreInventoryValuationPage })),
);

/** General Store routes. Rendered only in general-store or suite editions. */
export function generalStoreRoutes(): JSX.Element {
  return (
    <>
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
    </>
  );
}
