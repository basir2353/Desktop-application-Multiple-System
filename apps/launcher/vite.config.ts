import federation from "@originjs/vite-plugin-federation";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { editionExcludePlugin } from "./vite.edition-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

const VALID_EDITIONS = new Set(["suite", "restaurant", "pharmacy", "general-store"]);

function resolveEdition(env: Record<string, string>): string {
  const raw = (process.env.PLATFORM_EDITION ?? env.PLATFORM_EDITION ?? env.VITE_PLATFORM_EDITION ?? "suite").trim();
  return VALID_EDITIONS.has(raw) ? raw : "suite";
}

export default defineConfig(({ mode }) => {
  // Keep in sync with `envDir` so VITE_* from repo-root `.env` applies here too.
  const env = loadEnv(mode, monorepoRoot, "");
  const sampleRemote =
    env.VITE_SAMPLE_REMOTE_URL ?? "http://127.0.0.1:5001/assets/remoteEntry.js";
  const edition = resolveEdition(env);

  return {
    clearScreen: false,
    // Capacitor loads from file/https localhost — relative asset URLs required.
    base: process.env.CAP_MOBILE === "1" ? "./" : "/",
    define: {
      __PLATFORM_EDITION__: JSON.stringify(edition),
      __POPS_MOBILE_VARIANT__: JSON.stringify(process.env.POPS_MOBILE_VARIANT ?? ""),
    },
    server: {
      host: "127.0.0.1",
      port: 1420,
      strictPort: true,
      // Shop IP is PRA-whitelisted; proxy PostData so the browser can reach e-IMS without CORS.
      proxy: {
        "/pra-ims": {
          target: "https://ims.pral.com.pk",
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/pra-ims/, ""),
        },
      },
    },
    // Ensure .wasm is not treated as a text module / SPA fallback incorrectly.
    assetsInclude: ["**/*.wasm"],
    // Pre-bundle sql.js so Vite applies CJS↔ESM interop (raw exclude breaks `default` import).
    optimizeDeps: {
      include: ["sql.js"],
    },
    envDir: monorepoRoot,
    resolve: {
      alias: {
        "@platform/auth-client": path.join(monorepoRoot, "packages/auth-client/src/index.ts"),
        "@platform/connectivity": path.join(monorepoRoot, "packages/connectivity/src/index.ts"),
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
      {
        name: "fix-sql-wasm-spa-fallback",
        configureServer(server) {
          // Any mistaken /pos/sql-wasm.wasm (or nested) request → real public wasm.
          server.middlewares.use((req, _res, next) => {
            const url = req.url ?? "";
            if (url.includes("sql-wasm.wasm") && !url.startsWith("/sql-wasm.wasm")) {
              req.url = "/sql-wasm.wasm";
            }
            next();
          });
        },
      },
      editionExcludePlugin(edition),
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
