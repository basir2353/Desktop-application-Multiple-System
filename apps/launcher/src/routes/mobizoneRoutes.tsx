import { Route } from "react-router-dom";
import { MobizoneDashboardPage } from "../mobizone/pages/MobizoneDashboardPage";
import { MobizoneSellPage } from "../mobizone/pages/MobizoneSellPage";
import { MobizonePurchasePage } from "../mobizone/pages/MobizonePurchasePage";
import { MobizoneStockPage } from "../mobizone/pages/MobizoneStockPage";
import { MobizoneImeiPage } from "../mobizone/pages/MobizoneImeiPage";
import { MobizoneCustomersPage } from "../mobizone/pages/MobizoneCustomersPage";
import { MobizoneSearchPage } from "../mobizone/pages/MobizoneSearchPage";
import { MobizoneShopkeepersPage } from "../mobizone/pages/MobizoneShopkeepersPage";
import { MobizoneBanksPage } from "../mobizone/pages/MobizoneBanksPage";
import { MobizoneLedgerPage } from "../mobizone/pages/MobizoneLedgerPage";
import { MobizoneBusinessReportPage } from "../mobizone/pages/MobizoneBusinessReportPage";
import { MobizoneExpensesPage } from "../mobizone/pages/MobizoneExpensesPage";
import {
  MobizonePurchasesHistoryPage,
  MobizoneSalesHistoryPage,
} from "../mobizone/pages/MobizoneHistoryPages";
import {
  MobizonePaymentsPage,
  MobizoneProfitPage,
  MobizoneReportsPage,
} from "../mobizone/pages/MobizoneReportsPages";
import { MobizoneWhatsappPage } from "../mobizone/pages/MobizoneWhatsappPage";

/** MobiZone routes — rendered only in mobizone or suite editions. */
export function mobizoneRoutes(): JSX.Element {
  return (
    <>
      <Route path="mobizone" element={<MobizoneDashboardPage />} />
      <Route path="mobizone/dashboard" element={<MobizoneDashboardPage />} />
      <Route path="mobizone/sell" element={<MobizoneSellPage />} />
      <Route path="mobizone/purchase" element={<MobizonePurchasePage />} />
      <Route path="mobizone/sales" element={<MobizoneSalesHistoryPage />} />
      <Route path="mobizone/purchases" element={<MobizonePurchasesHistoryPage />} />
      <Route path="mobizone/stock" element={<MobizoneStockPage />} />
      <Route path="mobizone/imei" element={<MobizoneImeiPage />} />
      <Route path="mobizone/search" element={<MobizoneSearchPage />} />
      <Route path="mobizone/customers" element={<MobizoneCustomersPage />} />
      <Route path="mobizone/shopkeepers" element={<MobizoneShopkeepersPage />} />
      <Route path="mobizone/ledger" element={<MobizoneLedgerPage />} />
      <Route path="mobizone/banks" element={<MobizoneBanksPage />} />
      <Route path="mobizone/expenses" element={<MobizoneExpensesPage />} />
      <Route path="mobizone/payments" element={<MobizonePaymentsPage />} />
      <Route path="mobizone/business-report" element={<MobizoneBusinessReportPage />} />
      <Route path="mobizone/reports" element={<MobizoneReportsPage />} />
      <Route path="mobizone/profit" element={<MobizoneProfitPage />} />
      <Route path="mobizone/whatsapp" element={<MobizoneWhatsappPage />} />
    </>
  );
}
