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
import { MobizoneMoneyLedgerPage } from "../mobizone/pages/MobizoneMoneyLedgerPage";
import { MobizoneBusinessReportPage } from "../mobizone/pages/MobizoneBusinessReportPage";
import { MobizoneContraVoucherPage } from "../mobizone/pages/MobizoneContraVoucherPage";
import { MobizoneExpenseAccountsPage } from "../mobizone/pages/MobizoneExpenseAccountsPage";
import { MobizoneExpensesPage } from "../mobizone/pages/MobizoneExpensesPage";
import { MobizoneGeneralVoucherPage } from "../mobizone/pages/MobizoneGeneralVoucherPage";
import {
  MobizonePurchasesHistoryPage,
  MobizoneSalesHistoryPage,
} from "../mobizone/pages/MobizoneHistoryPages";
import {
  MobizonePurchaseReturnPage,
  MobizoneSaleReturnPage,
} from "../mobizone/pages/MobizoneReturnPages";
import {
  MobizonePaymentsPage,
  MobizoneProfitPage,
  MobizoneReportsPage,
} from "../mobizone/pages/MobizoneReportsPages";
import { MobizoneWhatsappPage } from "../mobizone/pages/MobizoneWhatsappPage";
import { MobizoneReceiptSettingsPage } from "../mobizone/pages/MobizoneReceiptSettingsPage";
import { MobizoneLegalRecordPage } from "../mobizone/pages/MobizoneLegalRecordPage";

/** MobiZone routes — rendered only in mobizone or suite editions. */
export function mobizoneRoutes(): JSX.Element {
  return (
    <>
      <Route path="mobizone" element={<MobizoneDashboardPage />} />
      <Route path="mobizone/dashboard" element={<MobizoneDashboardPage />} />
      <Route path="mobizone/sell" element={<MobizoneSellPage />} />
      <Route path="mobizone/purchase" element={<MobizonePurchasePage />} />
      <Route path="mobizone/sale-return" element={<MobizoneSaleReturnPage />} />
      <Route path="mobizone/purchase-return" element={<MobizonePurchaseReturnPage />} />
      <Route path="mobizone/sales" element={<MobizoneSalesHistoryPage />} />
      <Route path="mobizone/purchases" element={<MobizonePurchasesHistoryPage />} />
      <Route path="mobizone/stock" element={<MobizoneStockPage />} />
      <Route path="mobizone/imei" element={<MobizoneImeiPage />} />
      <Route path="mobizone/search" element={<MobizoneSearchPage />} />
      <Route path="mobizone/legal-record" element={<MobizoneLegalRecordPage />} />
      <Route path="mobizone/customers" element={<MobizoneCustomersPage />} />
      <Route path="mobizone/shopkeepers" element={<MobizoneShopkeepersPage />} />
      <Route path="mobizone/ledger" element={<MobizoneLedgerPage />} />
      <Route path="mobizone/money-ledger" element={<MobizoneMoneyLedgerPage />} />
      <Route path="mobizone/banks" element={<MobizoneBanksPage />} />
      <Route path="mobizone/expenses" element={<MobizoneExpensesPage />} />
      <Route path="mobizone/expense-accounts" element={<MobizoneExpenseAccountsPage />} />
      <Route path="mobizone/contra-voucher" element={<MobizoneContraVoucherPage />} />
      <Route path="mobizone/general-voucher" element={<MobizoneGeneralVoucherPage />} />
      <Route path="mobizone/payments" element={<MobizonePaymentsPage />} />
      <Route path="mobizone/business-report" element={<MobizoneBusinessReportPage />} />
      <Route path="mobizone/reports" element={<MobizoneReportsPage />} />
      <Route path="mobizone/profit" element={<MobizoneProfitPage />} />
      <Route path="mobizone/whatsapp" element={<MobizoneWhatsappPage />} />
      <Route path="mobizone/receipt-settings" element={<MobizoneReceiptSettingsPage />} />
    </>
  );
}
