/** Bootstrap DDL for WASM SQLite (no drizzle-kit migrate runner in the shell). */
export const SQLITE_BOOTSTRAP_DDL = `
CREATE TABLE IF NOT EXISTS installed_modules (
  slug TEXT PRIMARY KEY NOT NULL,
  version TEXT NOT NULL,
  remote_entry_url TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  scope TEXT PRIMARY KEY NOT NULL,
  cursor TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
