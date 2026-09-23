import { Route } from "react-router-dom";
import { TradeFlowBookingsPage } from "../tradeflow/pages/TradeFlowBookingsPage";
import { TradeFlowContraPage } from "../tradeflow/pages/TradeFlowContraPage";
import { TradeFlowCustomersPage } from "../tradeflow/pages/TradeFlowCustomersPage";
import { TradeFlowHomePage } from "../tradeflow/pages/TradeFlowHomePage";
import { TradeFlowInvoicesPage } from "../tradeflow/pages/TradeFlowInvoicesPage";
import { TradeFlowItemsPage } from "../tradeflow/pages/TradeFlowItemsPage";
import { TradeFlowJournalPage } from "../tradeflow/pages/TradeFlowJournalPage";
import { TradeFlowLedgerPage } from "../tradeflow/pages/TradeFlowLedgerPage";
import { TradeFlowMobilePage } from "../tradeflow/pages/TradeFlowMobilePage";
import { TradeFlowNotesPage } from "../tradeflow/pages/TradeFlowNotesPage";
import { TradeFlowPaymentsPage } from "../tradeflow/pages/TradeFlowPaymentsPage";
import { TradeFlowPosPage } from "../tradeflow/pages/TradeFlowPosPage";
import { TradeFlowPurchasePage } from "../tradeflow/pages/TradeFlowPurchasePage";
import { TradeFlowReturnsPage } from "../tradeflow/pages/TradeFlowReturnsPage";
import { TradeFlowSettingsPage } from "../tradeflow/pages/TradeFlowSettingsPage";
import { TradeFlowStockPage } from "../tradeflow/pages/TradeFlowStockPage";

export function tradeflowRoutes(): JSX.Element {
  return (
    <>
      <Route path="tradeflow" element={<TradeFlowHomePage />} />
      <Route path="tradeflow/dashboard" element={<TradeFlowHomePage />} />
      <Route path="tradeflow/pos" element={<TradeFlowPosPage />} />
      <Route path="tradeflow/bookings" element={<TradeFlowBookingsPage />} />
      <Route path="tradeflow/stock" element={<TradeFlowStockPage />} />
      <Route path="tradeflow/items" element={<TradeFlowItemsPage />} />
      <Route path="tradeflow/customers" element={<TradeFlowCustomersPage />} />
      <Route path="tradeflow/ledger" element={<TradeFlowLedgerPage />} />
      <Route path="tradeflow/payments" element={<TradeFlowPaymentsPage />} />
      <Route path="tradeflow/invoices" element={<TradeFlowInvoicesPage />} />
      <Route path="tradeflow/purchases" element={<TradeFlowPurchasePage />} />
      <Route path="tradeflow/returns" element={<TradeFlowReturnsPage />} />
      <Route path="tradeflow/notes" element={<TradeFlowNotesPage />} />
      <Route path="tradeflow/journal" element={<TradeFlowJournalPage />} />
      <Route path="tradeflow/contra" element={<TradeFlowContraPage />} />
      <Route path="tradeflow/settings" element={<TradeFlowSettingsPage />} />
      <Route path="tradeflow/mobile" element={<TradeFlowMobilePage />} />
    </>
  );
}
