/**
 * Live DB sync follows the Active server (no split):
 *   OLD Active  → copy NEW → OLD
 *   NEW Active  → copy OLD → NEW
 *
 * Incremental only: skip rows already on destination. Copy new PKs, and
 * rows whose updated_at is newer. Never DELETE / DROP / TRUNCATE.
 * Control: http://127.0.0.1:1421  (Health page)
 * Credentials: local/.env.sync.local
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import { lookup } from "node:dns/promises";

dns.setDefaultResultOrder("ipv4first");

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const require = createRequire(join(repoRoot, "backend-desktop/packages/database-pg/package.json"));
const { Client } = require("pg");

const SKIP_TABLES = new Set(["refresh_tokens"]);
const ENV_FILE = join(here, "live-env.json");
const AGENT_PORT = Number(process.env.SYNC_AGENT_PORT ?? 1421);

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(join(here, ".env.sync.local"));

const OLD_URL = process.env.OLD_DATABASE_URL?.trim();
const NEW_URL = process.env.NEW_DATABASE_URL?.trim();
const INTERVAL_MS = Math.max(15_000, Number(process.env.SYNC_INTERVAL_MS ?? 60_000));

if (!OLD_URL || !NEW_URL) {
  console.error("[sync] Missing OLD_DATABASE_URL or NEW_DATABASE_URL in local/.env.sync.local");
  process.exit(1);
}

function sslFor(url) {
  return /rlwy\.net|railway|amazonaws|neon\.tech/i.test(url)
    ? { rejectUnauthorized: false }
    : undefined;
}

function ident(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Refusing unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, size + i));
  return out;
}

function readActiveEnv() {
  try {
    if (!existsSync(ENV_FILE)) return "old";
    const parsed = JSON.parse(readFileSync(ENV_FILE, "utf8"));
    return parsed.active === "new" ? "new" : "old";
  } catch {
    return "old";
  }
}

function writeActiveEnv(active) {
  writeFileSync(ENV_FILE, `${JSON.stringify({ active, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function emptyReport() {
  return {
    ok: true,
    running: false,
    agent: "online",
    active: readActiveEnv(),
    direction: "",
    startedAt: null,
    finishedAt: null,
    ms: 0,
    elapsedMs: 0,
    etaMs: null,
    lastCycleMs: 0,
    tables: 0,
    tablesDone: 0,
    tablesTotal: 0,
    columns: 0,
    rows: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    currentTable: null,
    phase: "idle",
    details: [],
    errors: [],
  };
}

/** @type {any} */
let lastReport = emptyReport();
let lastCycleMs = 0;

let cycleQueued = false;
let cycleInFlight = false;

function directionLabel(active) {
  return active === "old" ? "NEW → OLD" : "OLD → NEW";
}

function rowKey(pk, row) {
  return pk.map((col) => String(row[col] ?? "")).join("\0");
}

function isNewer(srcVal, destVal) {
  const a = srcVal instanceof Date ? srcVal.getTime() : Date.parse(String(srcVal ?? ""));
  const b = destVal instanceof Date ? destVal.getTime() : Date.parse(String(destVal ?? ""));
  if (!Number.isFinite(a)) return false;
  if (!Number.isFinite(b)) return true;
  return a > b;
}

function etaFromProgress(started, tablesDone, tablesTotal) {
  if (tablesDone <= 0) return lastCycleMs || null;
  const elapsed = Date.now() - started;
  const remaining = Math.max(0, tablesTotal - tablesDone);
  return Math.round((elapsed / tablesDone) * remaining);
}

function parseDbUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "") || "railway"),
  };
}

async function pgClient(url, label) {
  const parsed = parseDbUrl(url);
  let host = parsed.host;
  try {
    const rec = await lookup(parsed.host, { family: 4 });
    host = rec.address;
    console.log(`[sync] ${label} DNS ${parsed.host}:${parsed.port} -> ${host}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[sync] ${label} DNS fallback to hostname: ${message}`);
  }

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    lastReport.phase = "connecting";
    lastReport.currentTable = `Connecting ${label} (${attempt}/2)`;
    lastReport.elapsedMs = lastReport.startedAt
      ? Date.now() - new Date(lastReport.startedAt).getTime()
      : 0;
    const client = new Client({
      host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: sslFor(url),
      connectionTimeoutMillis: 20_000,
      keepAlive: true,
    });
    try {
      process.stdout.write(`[sync] connecting ${label} (try ${attempt}/2)… `);
      await client.connect();
      client.on("error", (err) => {
        console.warn(`[sync] ${label} connection error: ${err instanceof Error ? err.message : String(err)}`);
      });
      await client.query("SET statement_timeout = '120s'");
      await client.query("SET lock_timeout = '15s'");
      console.log("ok");
      return client;
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`failed: ${message}`);
      lastReport.errors = [`${label} DB: ${message}`];
      await client.end().catch(() => undefined);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastErr;
}

function isConnectionError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return /connection terminated|ECONNRESET|ECONNREFUSED|Connection lost|server closed/i.test(message);
}

async function pingClient(client) {
  await client.query("SELECT 1");
}

async function ensureClient(client, url, label) {
  try {
    await pingClient(client);
    return client;
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    console.warn(`[sync] ${label} reconnecting after drop…`);
    await client.end().catch(() => undefined);
    return pgClient(url, label);
  }
}

async function listTables(client) {
  const { rows } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return rows.map((r) => r.tablename).filter((t) => !SKIP_TABLES.has(t));
}

async function primaryKey(client, table) {
  const { rows } = await client.query(
    `
    SELECT a.attname AS column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = $1::regclass
      AND i.indisprimary
    ORDER BY array_position(i.indkey, a.attnum)
    `,
    [`public.${table}`],
  );
  return rows.map((r) => r.column_name);
}

async function writableColumns(client, table) {
  const { rows } = await client.query(
    `
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND is_generated <> 'ALWAYS'
    ORDER BY ordinal_position
    `,
    [table],
  );
  return rows.map((r) => ({ name: r.column_name, udt: r.udt_name }));
}

function bindValue(value, udt) {
  if (value === null || value === undefined) return null;
  if (udt === "json" || udt === "jsonb") {
    if (value === "" || value === undefined || value === null) return JSON.stringify(null);
    return JSON.stringify(value);
  }
  if (value instanceof Date) return value;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) return value;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

async function disableFks(client) {
  try {
    await client.query("SET session_replication_role = replica");
    return true;
  } catch {
    return false;
  }
}

async function restoreFks(client) {
  try {
    await client.query("SET session_replication_role = origin");
  } catch {
    /* ignore */
  }
}

async function tablesInFkOrder(client, tables) {
  const { rows } = await client.query(`
    SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
  `);
  const set = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set()]));
  for (const row of rows) {
    const child = String(row.child).replace(/^public\./, "").replace(/"/g, "");
    const parent = String(row.parent).replace(/^public\./, "").replace(/"/g, "");
    if (child === parent) continue;
    if (set.has(child) && set.has(parent)) deps.get(child).add(parent);
  }
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visited.has(node) || !set.has(node)) return;
    if (visiting.has(node)) return;
    visiting.add(node);
    for (const parent of deps.get(node) ?? []) visit(parent);
    visiting.delete(node);
    visited.add(node);
    ordered.push(node);
  }
  for (const table of tables) visit(table);
  return ordered;
}

async function loadKeyRows(client, table, pk, hasUpdated) {
  const cols = [...pk, ...(hasUpdated ? ["updated_at"] : [])].map(ident).join(", ");
  const { rows } = await client.query(`SELECT ${cols} FROM ${ident(table)}`);
  const map = new Map();
  for (const row of rows) map.set(rowKey(pk, row), row);
  return map;
}

async function fetchFullRows(src, table, pk, colNames, keyRows) {
  if (keyRows.length === 0) return [];
  const quotedCols = colNames.map(ident).join(", ");
  const out = [];
  for (const batch of chunk(keyRows, 200)) {
    const values = [];
    const tuples = batch.map((row, rowIdx) => {
      const cells = pk.map((col, colIdx) => {
        values.push(row[col]);
        return `$${rowIdx * pk.length + colIdx + 1}`;
      });
      return `(${cells.join(", ")})`;
    });
    const { rows } = await src.query(
      `SELECT ${quotedCols} FROM ${ident(table)} WHERE (${pk.map(ident).join(", ")}) IN (${tuples.join(", ")})`,
      values,
    );
    out.push(...rows);
  }
  return out;
}

async function deltaRows(src, dest, table, pk, colNames) {
  const hasUpdated = colNames.includes("updated_at");
  const destMap = await loadKeyRows(dest, table, pk, hasUpdated);
  const srcMap = await loadKeyRows(src, table, pk, hasUpdated);
  const sourceCount = srcMap.size;

  if (sourceCount === 0) {
    return { rows: [], skipped: 0, sourceCount: 0 };
  }

  if (destMap.size === 0) {
    const quotedCols = colNames.map(ident).join(", ");
    const { rows } = await src.query(`SELECT ${quotedCols} FROM ${ident(table)}`);
    return { rows, skipped: 0, sourceCount: rows.length };
  }

  const needed = [];
  let skipped = 0;
  for (const [key, srcRow] of srcMap) {
    const existing = destMap.get(key);
    if (!existing) {
      needed.push(srcRow);
      continue;
    }
    if (hasUpdated && isNewer(srcRow.updated_at, existing.updated_at)) {
      needed.push(srcRow);
      continue;
    }
    skipped += 1;
  }

  if (needed.length === 0) {
    return { rows: [], skipped, sourceCount };
  }

  if (needed.length > sourceCount * 0.5) {
    const quotedCols = colNames.map(ident).join(", ");
    const { rows } = await src.query(`SELECT ${quotedCols} FROM ${ident(table)}`);
    const needKeys = new Set(needed.map((row) => rowKey(pk, row)));
    return {
      rows: rows.filter((row) => needKeys.has(rowKey(pk, row))),
      skipped,
      sourceCount,
    };
  }

  return {
    rows: await fetchFullRows(src, table, pk, colNames, needed),
    skipped,
    sourceCount,
  };
}

async function upsertTable(src, dest, table) {
  const pk = await primaryKey(src, table);
  if (pk.length === 0) {
    return { table, columns: 0, rows: 0, inserted: 0, updated: 0, skipped: 0, skippedTable: true };
  }

  const cols = await writableColumns(src, table);
  if (cols.length === 0) {
    return { table, columns: 0, rows: 0, inserted: 0, updated: 0, skipped: 0, skippedTable: true };
  }

  const colNames = cols.map((c) => c.name);
  const types = Object.fromEntries(cols.map((c) => [c.name, c.udt]));
  const delta = await deltaRows(src, dest, table, pk, colNames);
  if (delta.rows.length === 0) {
    return {
      table,
      columns: colNames.length,
      rows: 0,
      inserted: 0,
      updated: 0,
      skipped: delta.skipped,
      sourceCount: delta.sourceCount,
    };
  }

  const quotedCols = colNames.map(ident).join(", ");
  const conflict = pk.map(ident).join(", ");
  const updateSet = colNames
    .filter((c) => !pk.includes(c))
    .map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`)
    .join(", ");
  const onConflict = updateSet
    ? `ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}`
    : `ON CONFLICT (${conflict}) DO NOTHING`;

  let inserted = 0;
  let updated = 0;
  const batchSize = Math.max(1, Math.min(50, Math.floor(1500 / Math.max(colNames.length, 1))));

  for (const batch of chunk(delta.rows, batchSize)) {
    const values = [];
    const placeholders = batch.map((row, rowIdx) => {
      const cells = colNames.map((col, colIdx) => {
        values.push(bindValue(row[col], types[col]));
        return `$${rowIdx * colNames.length + colIdx + 1}`;
      });
      return `(${cells.join(", ")})`;
    });
    const result = await dest.query(
      `INSERT INTO ${ident(table)} (${quotedCols}) VALUES ${placeholders.join(", ")} ${onConflict} RETURNING (xmax = 0) AS inserted`,
      values,
    );
    for (const row of result.rows) {
      if (row.inserted) inserted += 1;
      else updated += 1;
    }
  }

  return {
    table,
    columns: colNames.length,
    rows: delta.rows.length,
    inserted,
    updated,
    skipped: delta.skipped,
    sourceCount: delta.sourceCount,
  };
}

async function runOnce() {
  const active = readActiveEnv();
  const fromName = active === "old" ? "NEW" : "OLD";
  const toName = active === "old" ? "OLD" : "NEW";
  const srcUrl = active === "old" ? NEW_URL : OLD_URL;
  const destUrl = active === "old" ? OLD_URL : NEW_URL;
  const startedAt = new Date().toISOString();
  const started = Date.now();

  lastReport = {
    ...lastReport,
    running: true,
    active,
    direction: `${fromName} → ${toName}`,
    startedAt,
    finishedAt: null,
    elapsedMs: 0,
    etaMs: lastCycleMs || null,
    lastCycleMs,
    errors: [],
    currentTable: `Connecting ${fromName}`,
    phase: "connecting",
    tablesDone: 0,
    tablesTotal: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    rows: 0,
    details: [],
  };

  const src = await pgClient(srcUrl, fromName);
  const dest = await pgClient(destUrl, toName);
  let srcLive = src;
  let destLive = dest;
  lastReport.phase = "syncing";
  let fksDisabled = false;
  const details = [];
  const errors = [];
  try {
    fksDisabled = await disableFks(destLive);
    const listed = await listTables(srcLive);
    const tables = fksDisabled ? listed : await tablesInFkOrder(srcLive, listed);
    lastReport.tablesTotal = tables.length;

    for (let i = 0; i < tables.length; i += 1) {
      const table = tables[i];
      lastReport.currentTable = table;
      lastReport.elapsedMs = Date.now() - started;
      lastReport.etaMs = etaFromProgress(started, i, tables.length);
      try {
        srcLive = await ensureClient(srcLive, srcUrl, fromName);
        destLive = await ensureClient(destLive, destUrl, toName);
        process.stdout.write(`[sync ${fromName}→${toName}] ${table}… `);
        const result = await upsertTable(srcLive, destLive, table);
        if (result.skippedTable) {
          console.log("skip (no pk)");
          lastReport.tablesDone = i + 1;
          lastReport.etaMs = etaFromProgress(started, i + 1, tables.length);
          continue;
        }
        details.push(result);
        lastReport.details = details;
        lastReport.tablesDone = i + 1;
        lastReport.tables = details.length;
        lastReport.columns = details.reduce((n, d) => n + (d.columns ?? 0), 0);
        lastReport.inserted = details.reduce((n, d) => n + (d.inserted ?? 0), 0);
        lastReport.updated = details.reduce((n, d) => n + (d.updated ?? 0), 0);
        lastReport.skipped = details.reduce((n, d) => n + (d.skipped ?? 0), 0);
        lastReport.rows = lastReport.inserted + lastReport.updated;
        lastReport.elapsedMs = Date.now() - started;
        lastReport.etaMs = etaFromProgress(started, i + 1, tables.length);
        if (result.inserted || result.updated) {
          console.log(
            `${result.inserted} new / ${result.updated} changed (${result.skipped} already there)`,
          );
        } else {
          console.log(`already there (${result.skipped} rows, no copy)`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${table}: ${message}`);
        details.push({ table, columns: 0, rows: 0, inserted: 0, updated: 0, skipped: 0, error: message });
        lastReport.details = details;
        lastReport.errors = errors;
        lastReport.tablesDone = i + 1;
        lastReport.etaMs = etaFromProgress(started, i + 1, tables.length);
        console.warn(`failed: ${message}`);
      }
    }
  } finally {
    if (fksDisabled) await restoreFks(destLive);
    await srcLive.end().catch(() => undefined);
    await destLive.end().catch(() => undefined);
  }

  const ms = Date.now() - started;
  lastCycleMs = ms;
  const synced = details.filter((d) => !d.error && !d.skippedTable);
  lastReport = {
    ok: errors.length === 0,
    running: false,
    agent: "online",
    active,
    direction: `${fromName} → ${toName}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    ms,
    elapsedMs: ms,
    etaMs: 0,
    lastCycleMs: ms,
    tables: synced.length,
    tablesDone: synced.length,
    tablesTotal: synced.length,
    columns: synced.reduce((n, d) => n + (d.columns ?? 0), 0),
    rows: synced.reduce((n, d) => n + (d.inserted ?? 0) + (d.updated ?? 0), 0),
    inserted: synced.reduce((n, d) => n + (d.inserted ?? 0), 0),
    updated: synced.reduce((n, d) => n + (d.updated ?? 0), 0),
    skipped: synced.reduce((n, d) => n + (d.skipped ?? 0), 0),
    currentTable: null,
    phase: "idle",
    details,
    errors,
  };
  console.log(
    `[sync] ${lastReport.direction} copied=${lastReport.rows} new=${lastReport.inserted} changed=${lastReport.updated} skipped=${lastReport.skipped} ${ms}ms`,
  );
}

async function runCycle() {
  if (cycleInFlight) {
    cycleQueued = true;
    return;
  }
  cycleInFlight = true;
  try {
    await runOnce();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastReport = {
      ...lastReport,
      ok: false,
      running: false,
      phase: "idle",
      finishedAt: new Date().toISOString(),
      currentTable: null,
      etaMs: 0,
      errors: lastReport.errors?.length ? lastReport.errors : [message],
    };
    console.error("[sync] cycle failed:", message);
  } finally {
    cycleInFlight = false;
    if (cycleQueued) {
      cycleQueued = false;
      void runCycle();
    }
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function startAgent() {
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && (url.pathname === "/status" || url.pathname === "/")) {
      if (lastReport.running && lastReport.startedAt) {
        lastReport.elapsedMs = Date.now() - Date.parse(lastReport.startedAt);
      }
      json(res, 200, lastReport);
      return;
    }
    if (req.method === "POST" && url.pathname === "/activate") {
      let raw = "";
      for await (const part of req) raw += part;
      let active = "old";
      try {
        const parsed = JSON.parse(raw || "{}");
        active = parsed.env === "new" ? "new" : "old";
      } catch {
        active = "old";
      }
      const prev = readActiveEnv();
      writeActiveEnv(active);
      lastReport.active = active;
      lastReport.direction = directionLabel(active);
      const switched = active !== prev;
      if (switched) void runCycle();
      json(res, 202, {
        ok: true,
        active,
        direction: directionLabel(active),
        running: cycleInFlight || switched,
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/sync") {
      void runCycle();
      json(res, 202, {
        ok: true,
        running: true,
        queued: cycleInFlight,
        direction: lastReport.direction || directionLabel(readActiveEnv()),
      });
      return;
    }
    json(res, 404, { error: "not found" });
  });
  server.listen(AGENT_PORT, "127.0.0.1", () => {
    console.log(`[sync] agent http://127.0.0.1:${AGENT_PORT}/status`);
  });
}

writeActiveEnv(readActiveEnv());
startAgent();
console.log(`[sync] Active=${readActiveEnv()} (${directionLabel(readActiveEnv())}) incremental every ${INTERVAL_MS / 1000}s`);

process.on("uncaughtException", (err) => {
  console.error("[sync] uncaughtException (agent stays up):", err instanceof Error ? err.message : err);
});
process.on("unhandledRejection", (err) => {
  console.error("[sync] unhandledRejection (agent stays up):", err instanceof Error ? err.message : err);
});

setInterval(() => {
  void runCycle();
}, INTERVAL_MS);
void runCycle();
