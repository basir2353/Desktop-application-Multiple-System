#!/usr/bin/env node
/**
 * Lightweight concurrency probe for the live (or local) API.
 *
 * Usage:
 *   node backend-desktop/api/scripts/load-test-scale.mjs
 *   API_BASE=https://backend-desktop-production-600b.up.railway.app CONCURRENCY=200 node backend-desktop/api/scripts/load-test-scale.mjs
 *
 * This hits /health and /health/scale only (safe). For order/login soak tests, extend paths carefully.
 */
const base = (process.env.API_BASE ?? "https://backend-desktop-production-600b.up.railway.app").replace(
  /\/$/,
  "",
);
const concurrency = Math.max(1, Number(process.env.CONCURRENCY ?? 100));
const rounds = Math.max(1, Number(process.env.ROUNDS ?? 3));
const path = process.env.LOAD_PATH ?? "/health";

async function one(i) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { method: "GET" });
    return { i, ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch (err) {
    return {
      i,
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function wave(n) {
  const results = await Promise.all(Array.from({ length: n }, (_, i) => one(i)));
  const ok = results.filter((r) => r.ok).length;
  const fail = results.length - ok;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  const p99 = times[Math.floor(times.length * 0.99)] ?? 0;
  const statuses = {};
  for (const r of results) {
    const k = String(r.status);
    statuses[k] = (statuses[k] ?? 0) + 1;
  }
  return { ok, fail, p50, p95, p99, statuses };
}

console.log(`[load-test] base=${base} path=${path} concurrency=${concurrency} rounds=${rounds}`);

try {
  const scale = await fetch(`${base}/health/scale`);
  console.log(`[load-test] /health/scale => ${scale.status} ${await scale.text()}`);
} catch (err) {
  console.warn("[load-test] /health/scale failed:", err instanceof Error ? err.message : err);
}

for (let r = 1; r <= rounds; r++) {
  const w = await wave(concurrency);
  console.log(
    `[load-test] round ${r}: ok=${w.ok} fail=${w.fail} p50=${w.p50}ms p95=${w.p95}ms p99=${w.p99}ms statuses=${JSON.stringify(w.statuses)}`,
  );
}
