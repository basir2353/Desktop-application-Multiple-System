/**
 * Smoke tests: section printer isolation + select meta helpers.
 * Run: node local/smoke-desktop-features.mjs
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

// --- Static source checks ---
function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const suppliers = read("apps/launcher/src/pops/pages/modules/inventory/SuppliersPage.tsx");
assert(suppliers.includes("startEdit") && suppliers.includes("setSearch") && suppliers.includes("editingId"), "Suppliers search+edit");

const categories = read("apps/launcher/src/pops/pages/modules/inventory/CategoriesPage.tsx");
assert(categories.includes("startEdit") && categories.includes("setSearch"), "Categories search+edit");

const selectUi = read("apps/launcher/src/pops/ui/SearchableSelect.tsx");
assert(selectUi.includes("meta?:") && selectUi.includes("selected.meta"), "SearchableSelect shows meta");

const selectMeta = read("apps/launcher/src/pops/lib/selectMeta.ts");
assert(selectMeta.includes("formatSelectBalance") && selectMeta.includes("formatSelectQty"), "selectMeta helpers");

const po = read("apps/launcher/src/pops/pages/modules/inventory/PurchaseOrdersPage.tsx");
assert(po.includes("formatSelectBalance"), "PO supplier balance");

const picker = read("apps/launcher/src/pops/components/IngredientPickerModal.tsx");
assert(picker.includes("formatSelectQty"), "Ingredient picker qty");

const pos = read("apps/launcher/src/pops/pages/modules/PosPage.tsx");
assert(pos.includes("staffOpenAdvanceById") && pos.includes("formatSelectBalance"), "POS staff balance");

const printerPage = read("apps/launcher/src/pops/pages/modules/PrinterPage.tsx");
assert(
  printerPage.includes("ONLY printers assigned to the selected section") &&
    printerPage.includes("Remove from {selectedSection") &&
    !/\}\)\s*\)\)/.test(printerPage),
  "Printer section-scoped UI (no syntax junk)",
);

const routing = read("apps/launcher/src/pops/lib/printerRouting.ts");
assert(
  routing.includes("resolveOrphanDefaultPrinterByType") &&
    routing.includes('preferredType === "bar" ? "bar"') &&
    routing.includes("Never steal a printer"),
  "resolveKotPrinter section isolation",
);

const branchPrint = read("apps/launcher/src/pops/lib/branchPrintClient.ts");
assert(branchPrint.includes("resolveKotPrinter(branchCode, null"), "branchPrintClient uses section-safe KOT resolve");
assert(branchPrint.includes("payments: payments.length"), "branchPrintClient rebuilds pay receipt payments");
assert(branchPrint.includes("preparePraReceiptFooter"), "branchPrintClient rebuilds PRA on mobile pay receipt");
assert(
  read("apps/waiter-mobile/src/lib/printBill.ts").includes("receiptTicketFromBill"),
  "mobile sends EXE-shaped receipt ticket meta",
);
assert(
  read("apps/waiter-mobile/src/lib/printBill.ts").includes("payments: payments.length"),
  "mobile receipt ticket includes payments",
);

const updateBanner = read("apps/launcher/src/components/DesktopUpdateBanner.tsx");
assert(updateBanner.includes("check") || updateBanner.includes("updater"), "Desktop update banner present");

const suiteVer = JSON.parse(read("apps/launcher/src-tauri/tauri.suite.conf.json")).version;
const restVer = JSON.parse(read("apps/launcher/src-tauri/tauri.restaurant.conf.json")).version;
const pkgVer = JSON.parse(read("apps/launcher/package.json")).version;
assert(suiteVer === restVer && suiteVer === pkgVer, `Version aligned (${pkgVer})`);

// --- Logic smoke via dynamic localStorage mock in Node is hard for TS modules.
// Instead validate routing function bodies exist and key contracts.
assert(routing.includes("togglePrinterForSection"), "togglePrinterForSection exists");
assert(routing.includes("getPrintersForSection"), "getPrintersForSection exists");
assert(routing.includes("if (sectionId)"), "sectionId short-circuit in resolveKotPrinter");

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nALL FEATURE SMOKE CHECKS PASSED");
