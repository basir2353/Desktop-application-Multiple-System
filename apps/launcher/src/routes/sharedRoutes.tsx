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
const ClosingPage = lazy(() =>
  import("../pops/pages/modules/ClosingPage").then((m) => ({ default: m.ClosingPage })),
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
      <Route path="closing" element={<ClosingPage />} />
    </>
  );
}
