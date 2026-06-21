import type { SessionContext } from "@platform/shared-types";

export type ShellConfig = {
  apiBaseUrl: string;
};

export type ShellHost = {
  getSession(): SessionContext | null;
  getConfig(): ShellConfig;
  navigate(path: string): void;
  trackEvent(name: string, props?: Record<string, string | number | boolean>): void;
};

let host: ShellHost | null = null;

export function registerShellHost(h: ShellHost): void {
  host = h;
}

export function getShellHost(): ShellHost {
  if (!host) {
    throw new Error("Shell host not registered");
  }
  return host;
}
