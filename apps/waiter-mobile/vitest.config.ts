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
      "@platform/contracts": path.join(monorepoRoot, "packages/contracts/src/index.ts"),
      "@platform/auth-client": path.join(monorepoRoot, "packages/auth-client/src/index.ts"),
    },
  },
});
