import { Route } from "react-router-dom";
import { lazy } from "react";

// Shared ERP routes available in every edition (restaurant, pharmacy, store, suite).
const AuthPage = lazy(() => import("../pops/pages/modules/AuthPage").then((m) => ({ default: m.AuthPage })));
const NotificationsPage = lazy(() =>
  import("../pops/pages/modules/NotificationsPage").then((m) => ({ default: m.NotificationsPage })),
);
const NotificationTemplatesPage = lazy(() =>
  import("../pops/pages/modules/notifications/NotificationTemplatesPage").then((m) => ({ default: m.NotificationTemplatesPage })),
);
const SecurityPage = lazy(() =>
  import("../pops/pages/modules/SecurityPage").then((m) => ({ default: m.SecurityPage })),
);
const SettingsPage = lazy(() =>
  import("../pops/pages/modules/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const TaxPage = lazy(() => import("../pops/pages/modules/TaxPage").then((m) => ({ default: m.TaxPage })));
const PrinterPage = lazy(() =>
  import("../pops/pages/modules/PrinterPage").then((m) => ({ default: m.PrinterPage })),
);
const ClosingPage = lazy(() =>
  import("../pops/pages/modules/ClosingPage").then((m) => ({ default: m.ClosingPage })),
);
const MultiBranchDashboardPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/MultiBranchDashboardPage").then((m) => ({
    default: m.MultiBranchDashboardPage,
  })),
);
const InterBranchTransfersPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/InterBranchTransfersPage").then((m) => ({
    default: m.InterBranchTransfersPage,
  })),
);
const BranchReceivePage = lazy(() =>
  import("../pops/pages/modules/multi-branch/BranchReceivePage").then((m) => ({
    default: m.BranchReceivePage,
  })),
);
const BranchPricingPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/BranchPricingPage").then((m) => ({
    default: m.BranchPricingPage,
  })),
);
const ConsolidatedReportsPage = lazy(() =>
  import("../pops/pages/modules/multi-branch/ConsolidatedReportsPage").then((m) => ({
    default: m.ConsolidatedReportsPage,
  })),
);

/** Routes present in every edition. */
export function sharedRoutes(): JSX.Element {
  return (
    <>
      <Route path="auth" element={<AuthPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="notifications/templates" element={<NotificationTemplatesPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="tax" element={<TaxPage />} />
      <Route path="printer" element={<PrinterPage />} />
      <Route path="closing" element={<ClosingPage />} />
      {/* Branch create/manage must be available before any branch exists. */}
      <Route path="multi-branch" element={<MultiBranchDashboardPage />} />
      <Route path="multi-branch/transfers" element={<InterBranchTransfersPage />} />
      <Route path="multi-branch/receive" element={<BranchReceivePage />} />
      <Route path="multi-branch/pricing" element={<BranchPricingPage />} />
      <Route path="multi-branch/reports" element={<ConsolidatedReportsPage />} />
    </>
  );
}
