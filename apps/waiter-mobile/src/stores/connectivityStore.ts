import { create } from "zustand";

type ConnectivityState = {
  online: boolean;
  setOnline: (online: boolean) => void;
};

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));

export function markOnline(): void {
  useConnectivityStore.getState().setOnline(true);
}

export function markOffline(): void {
  useConnectivityStore.getState().setOnline(false);
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  return /network|fetch|failed|timeout|ECONNREFUSED|ENOTFOUND/i.test(err.message);
}

export function trackFetchResult(err: unknown | null): void {
  if (err && isNetworkError(err)) markOffline();
  else markOnline();
}
