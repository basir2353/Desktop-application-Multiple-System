import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let sqlJsDir;
try {
  const entry = require.resolve("sql.js");
  sqlJsDir = dirname(entry);
} catch {
  console.warn("[copy-sql-wasm] sql.js not installed yet; skipping");
  process.exit(0);
}

const wasmSrc = join(sqlJsDir, "sql-wasm.wasm");
const browserWasmSrc = join(sqlJsDir, "sql-wasm-browser.wasm");
const wasmDestDir = join(__dirname, "..", "public");
const wasmDest = join(wasmDestDir, "sql-wasm.wasm");
const browserWasmDest = join(wasmDestDir, "sql-wasm-browser.wasm");

if (!existsSync(wasmSrc)) {
  console.warn("[copy-sql-wasm] sql-wasm.wasm not found at", wasmSrc);
  process.exit(0);
}

mkdirSync(wasmDestDir, { recursive: true });
copyFileSync(wasmSrc, wasmDest);
console.log("[copy-sql-wasm] copied to", wasmDest);
// Browser entry of sql.js requests this filename; same binary as sql-wasm.wasm.
const browserSrc = existsSync(browserWasmSrc) ? browserWasmSrc : wasmSrc;
copyFileSync(browserSrc, browserWasmDest);
console.log("[copy-sql-wasm] copied to", browserWasmDest);
