import { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { SystemSelectPage } from "./pages/SystemSelectPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { RoleSelectPage } from "./pages/RoleSelectPage";
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
import { HAS_GENERAL_STORE, HAS_PHARMACY, HAS_RESTAURANT } from "./lib/edition";
import { restaurantRoutes } from "./routes/restaurantRoutes";
import { pharmacyRoutes } from "./routes/pharmacyRoutes";
import { generalStoreRoutes } from "./routes/generalStoreRoutes";
import { sharedRoutes } from "./routes/sharedRoutes";
import { HistoryNavBar } from "./components/HistoryNavBar";
import { ConnectivityBanner } from "./components/ConnectivityBanner";
import { MaintenanceBanner } from "./components/MaintenanceBanner";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { NavigationHistoryProvider } from "./hooks/useNavigationHistory";
import { RootErrorBoundary } from "./components/RootErrorBoundary";
import { ThemeProvider } from "./components/ThemeProvider";
import { screenCenterClass } from "./pops/lib/themeClasses";
import { isSuperAdminClaims } from "./lib/jwt";
import { SuperAdminShell } from "./super-admin/SuperAdminShell";
import { SuperAdminOverviewPage } from "./super-admin/SuperAdminOverviewPage";
import { SuperAdminBusinessesPage } from "./super-admin/SuperAdminBusinessesPage";
import { SuperAdminBusinessDetailPage } from "./super-admin/SuperAdminBusinessDetailPage";
import { SuperAdminUsersPage } from "./super-admin/SuperAdminUsersPage";
import { SuperAdminLicencesPage } from "./super-admin/SuperAdminLicencesPage";
import { SuperAdminSettingsPage } from "./super-admin/SuperAdminSettingsPage";
import { SuperAdminHealthPage } from "./super-admin/SuperAdminHealthPage";
import { SuperAdminTaxMapPage } from "./super-admin/SuperAdminTaxMapPage";
import { SuperAdminPaymentsPage } from "./super-admin/SuperAdminPaymentsPage";
import { SuperAdminSecurityPage } from "./super-admin/SuperAdminSecurityPage";
import { SuperAdminBroadcastPage } from "./super-admin/SuperAdminBroadcastPage";

function Protected({ children }: { children: JSX.Element }): JSX.Element {
  const sessionReady = useSessionReady();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);

  useEffect(() => {
    if (sessionReady) void bootstrapSession();
  }, [sessionReady]);

  if (!sessionReady) {
    return <div className={screenCenterClass}>Restoring session…</div>;
  }
  if (!accessToken) return <Navigate to="/role" replace />;
  if (isSuperAdminClaims(claims)) return <Navigate to="/super-admin" replace />;
  return children;
}

function SuperAdminOnly({ children }: { children: JSX.Element }): JSX.Element {
  const sessionReady = useSessionReady();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);

  useEffect(() => {
    if (sessionReady) void bootstrapSession();
  }, [sessionReady]);

  if (!sessionReady) {
    return <div className={screenCenterClass}>Restoring session…</div>;
  }
  if (!accessToken) return <Navigate to="/login?role=super_admin" replace />;
  if (!isSuperAdminClaims(claims)) return <Navigate to="/" replace />;
  return children;
}

export function App(): JSX.Element {
  const [ready, setReady] = useState(false);
  useOfflineSync();

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
          <MaintenanceBanner />
          <ConnectivityBanner />
          <RootErrorBoundary>
          <Routes>
          <Route path="/role" element={<RoleSelectPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/" element={<SystemSelectPage />} />
          <Route
            path="/super-admin"
            element={
              <SuperAdminOnly>
                <SuperAdminShell />
              </SuperAdminOnly>
            }
          >
            <Route index element={<SuperAdminOverviewPage />} />
            <Route path="businesses" element={<SuperAdminBusinessesPage />} />
            <Route path="businesses/:businessId" element={<SuperAdminBusinessDetailPage />} />
            <Route path="users" element={<SuperAdminUsersPage />} />
            <Route path="licences" element={<SuperAdminLicencesPage />} />
            <Route path="tax" element={<SuperAdminTaxMapPage />} />
            <Route path="payments" element={<SuperAdminPaymentsPage />} />
            <Route path="health" element={<SuperAdminHealthPage />} />
            <Route path="security" element={<SuperAdminSecurityPage />} />
            <Route path="broadcast" element={<SuperAdminBroadcastPage />} />
            <Route path="settings" element={<SuperAdminSettingsPage />} />
          </Route>
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
              <Route
                element={
                  <Suspense fallback={<div className={screenCenterClass}>Loading…</div>}>
                    <PopsShell />
                  </Suspense>
                }
              >
                {/* Edition-gated module routes. A locked installer only registers
                    its own system, so other modules are neither routable nor
                    bundled into that build. */}
                {sharedRoutes()}
                {HAS_RESTAURANT ? restaurantRoutes() : null}
                {HAS_PHARMACY ? pharmacyRoutes() : null}
                {HAS_GENERAL_STORE ? generalStoreRoutes() : null}
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
