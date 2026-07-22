import { Navigate, Outlet } from "react-router-dom";
import { useSystemReady } from "../hooks/useSystemReady";
import { screenCenterClass } from "../pops/lib/themeClasses";
import { useSystemStore } from "../stores/systemStore";

/** Ensures a business system was chosen on the launcher start screen. */
export function SystemGate(): JSX.Element {
  const systemReady = useSystemReady();
  const systemId = useSystemStore((s) => s.systemId);
  if (!systemReady) {
    return <div className={screenCenterClass}>Loading…</div>;
  }
  if (!systemId) return <Navigate to="/" replace />;
  return <Outlet />;
}
