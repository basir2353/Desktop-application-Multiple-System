import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  // Keep in sync with `envDir` so VITE_* from repo-root `.env` applies here too.
  const env = loadEnv(mode, monorepoRoot, "");
  const sampleRemote =
    env.VITE_SAMPLE_REMOTE_URL ?? "http://127.0.0.1:5001/assets/remoteEntry.js";

  return {
    clearScreen: false,
    server: {
      host: "127.0.0.1",
      port: 1420,
      strictPort: true,
    },
    envDir: monorepoRoot,
    resolve: {
      alias: {
        "@platform/auth-client": path.join(monorepoRoot, "packages/auth-client/src/index.ts"),
        "@platform/contracts": path.join(monorepoRoot, "packages/contracts/src/index.ts"),
        "@platform/database-sqlite": path.join(monorepoRoot, "packages/database-sqlite/src/index.ts"),
        "@platform/permissions": path.join(monorepoRoot, "packages/permissions/src/index.ts"),
        "@platform/shell-sdk": path.join(monorepoRoot, "packages/shell-sdk/src/index.ts"),
        "@platform/sync-engine": path.join(monorepoRoot, "packages/sync-engine/src/index.ts"),
        "@platform/shared-types": path.join(monorepoRoot, "packages/shared-types/src/index.ts"),
        "@platform/ui": path.join(monorepoRoot, "packages/ui/src/index.ts"),
      },
    },
    plugins: [
      react(),
      federation({
        name: "launcher",
        remotes: {
          sample: sampleRemote,
        },
        shared: ["react", "react-dom"],
      }),
    ],
    build: {
      target: "esnext",
      minify: !process.env.TAURI_ENV ? "esbuild" : false,
      sourcemap: !!process.env.TAURI_ENV,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  };
});
