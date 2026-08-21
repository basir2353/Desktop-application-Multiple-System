/// <reference types="vite/client" />

/** Business module baked into this build. Injected by Vite `define`. */
declare const __PLATFORM_EDITION__: string;
declare const __POPS_MOBILE_VARIANT__: string;

interface Window {
  __POPS_MOBILE_VARIANT__?: string;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_LIVE_ENV?: "old" | "new";
  readonly VITE_SAMPLE_REMOTE_URL?: string;
  readonly VITE_PLATFORM_EDITION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "sample/App" {
  import type { ComponentType } from "react";
  export const App: ComponentType;
}
