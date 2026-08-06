import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
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
});
