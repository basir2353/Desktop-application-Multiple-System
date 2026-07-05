/// <reference types="vite/client" />

/** Business module baked into this build. Injected by Vite `define`. */
declare const __PLATFORM_EDITION__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
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
