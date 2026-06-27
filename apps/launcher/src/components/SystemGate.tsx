import { Navigate, Outlet } from "react-router-dom";
import { useSystemStore } from "../stores/systemStore";

/** Ensures a business system was chosen on the launcher start screen. */
export function SystemGate(): JSX.Element {
  const systemId = useSystemStore((s) => s.systemId);
  if (!systemId) return <Navigate to="/" replace />;
  return <Outlet />;
}
