import { useConnectivity } from "../hooks/useConnectivity";

export function ConnectivityBanner(): JSX.Element | null {
  const online = useConnectivity();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:text-amber-200"
    >
      Offline — changes are saved locally and will sync when connection returns.
    </div>
  );
}
