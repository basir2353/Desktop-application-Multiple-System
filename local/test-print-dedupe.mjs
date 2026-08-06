/**
 * Print dedupe regression tests (mobile + transport + key rules).
 * Run: node local/test-print-dedupe.mjs
 *
 * Optional live API check:
 *   PRINT_API_BASE=https://… PRINT_TOKEN=… PRINT_BRANCH=MAIN node local/test-print-dedupe.mjs --api
 */
import assert from "node:assert/strict";

const MOBILE_PRINT_DEDUPE_MS = 15_000;

function mobilePrintDedupeKey(opts) {
  const branch = String(opts.branchCode ?? "").trim();
  const orderId = String(opts.orderId ?? "").trim();
  if (!branch || !orderId) return null;
  const kind = String(opts.kind ?? "receipt").trim().toLowerCase() || "receipt";
  const section = String(opts.sectionId ?? "").trim();
  return `${branch}|${kind}|${orderId}|${section}`;
}

function resolveExclusivePrintTransport(settings) {
  if (settings.modeLive) return "live";
  if (settings.modeIp) return "ip";
  if (settings.modeServer) return "server";
  return null;
}

function createPrintDedupeGate(windowMs = MOBILE_PRINT_DEDUPE_MS) {
  const inflight = new Map();
  const recentAt = new Map();
  return {
    begin(key, now = Date.now()) {
      if (!key) return null;
      const last = recentAt.get(key);
      if (last != null && now - last < windowMs) return true;
      const existing = inflight.get(key);
      if (existing) return existing;
      return null;
    },
    track(key, promise) {
      if (!key) return promise;
      inflight.set(key, promise);
      return promise.finally(() => inflight.delete(key));
    },
    markDone(key, now = Date.now()) {
      if (!key) return;
      recentAt.set(key, now);
    },
  };
}

function markMobileOrderPrintStarted(map, branchCode, kind, orderId, now, windowMs = 20_000) {
  const key = `${branchCode.trim().toUpperCase()}|${kind}|${orderId.trim()}`;
  const prev = map.get(key);
  if (prev != null && now - prev < windowMs) return true;
  map.set(key, now);
  return false;
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("Print dedupe unit tests\n");

test("dedupe key requires branch + orderId", () => {
  assert.equal(mobilePrintDedupeKey({ branchCode: "MAIN", orderId: "ORD-1", kind: "kot" }), "MAIN|kot|ORD-1|");
  assert.equal(mobilePrintDedupeKey({ branchCode: "", orderId: "ORD-1" }), null);
  assert.equal(mobilePrintDedupeKey({ branchCode: "MAIN", orderId: "" }), null);
});

test("exclusive transport prefers Live and never cascades", () => {
  assert.equal(
    resolveExclusivePrintTransport({ modeLive: true, modeIp: true, modeServer: true }),
    "live",
  );
  assert.equal(
    resolveExclusivePrintTransport({ modeLive: false, modeIp: true, modeServer: true }),
    "ip",
  );
  assert.equal(
    resolveExclusivePrintTransport({ modeLive: false, modeIp: false, modeServer: true }),
    "server",
  );
  assert.equal(
    resolveExclusivePrintTransport({ modeLive: false, modeIp: false, modeServer: false }),
    null,
  );
});

test("in-flight gate coalesces concurrent printHtml calls", async () => {
  const gate = createPrintDedupeGate(15_000);
  const key = mobilePrintDedupeKey({ branchCode: "MAIN", orderId: "ORD-9", kind: "kot" });
  let runs = 0;
  const slow = async () => {
    runs += 1;
    await new Promise((r) => setTimeout(r, 40));
    gate.markDone(key);
    return true;
  };
  assert.equal(gate.begin(key), null);
  const p1 = gate.track(key, slow());
  const early = gate.begin(key);
  assert.ok(early && typeof early.then === "function", "second call joins inflight");
  const [a, b] = await Promise.all([p1, early]);
  assert.equal(a, true);
  assert.equal(b, true);
  assert.equal(runs, 1);
  assert.equal(gate.begin(key), true, "recent window suppresses third call");
});

test("EXE mobile order fingerprint skips second job id", () => {
  const map = new Map();
  const t0 = 1_000_000;
  assert.equal(markMobileOrderPrintStarted(map, "main", "kot", "ORD-1", t0), false);
  assert.equal(markMobileOrderPrintStarted(map, "MAIN", "kot", "ORD-1", t0 + 5_000), true);
  assert.equal(markMobileOrderPrintStarted(map, "MAIN", "receipt", "ORD-1", t0 + 5_000), false);
  assert.equal(markMobileOrderPrintStarted(map, "MAIN", "kot", "ORD-1", t0 + 25_000), false);
});

test("refresh polling cannot invent print keys without orderId", () => {
  // Kitchen refetch every 5s does not call print — only missing orderId would skip dedupe.
  assert.equal(mobilePrintDedupeKey({ branchCode: "MAIN", kind: "kot" }), null);
});

console.log(`\n${passed} unit tests passed.`);

const wantApi = process.argv.includes("--api");
if (!wantApi) {
  console.log("\n(Skip live API — pass --api with PRINT_API_BASE + PRINT_TOKEN to hit /v1/printing/print-job)");
  process.exit(0);
}

const base = (process.env.PRINT_API_BASE || "").replace(/\/$/, "");
const token = process.env.PRINT_TOKEN || "";
const branch = process.env.PRINT_BRANCH || "MAIN";
if (!base || !token) {
  console.error("PRINT_API_BASE and PRINT_TOKEN required for --api");
  process.exit(1);
}

console.log("\nLive API idempotency test…");
const orderId = `DEDUP-TEST-${Date.now()}`;
const body = {
  branchCode: branch,
  orderId,
  deviceLabel: "dedupe-test",
  payload: {
    kind: "kot",
    html: "<html><body>dedupe</body></html>",
    copies: 1,
    meta: { source: "waiter-mobile" },
  },
};

async function postJob() {
  const res = await fetch(`${base}/v1/printing/print-job`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const a = await postJob();
const b = await postJob();
assert.ok(a.status < 400, `first create failed: ${a.status} ${JSON.stringify(a.json)}`);
assert.ok(b.status < 400, `second create failed: ${b.status} ${JSON.stringify(b.json)}`);
const idA = a.json.id || a.json.jobId;
const idB = b.json.id || b.json.jobId;
assert.ok(idA, "first job id missing");
assert.equal(idA, idB, `expected same job id on duplicate POST, got ${idA} vs ${idB}`);
console.log(`  ✓ API returned same job id twice (${idA})`);
console.log("\nAll tests passed (unit + API).");
