use crate::printing::PrintJobRow;
use rusqlite::{params, Connection};
use serde::Serialize;

#[derive(Clone, Serialize)]
pub struct PrinterRow {
    pub id: String,
    pub branch_code: String,
    pub name: String,
    pub windows_printer_name: Option<String>,
    pub ip_address: Option<String>,
    pub port: Option<i32>,
    pub connection_type: String,
    pub online: bool,
    pub last_heartbeat_at: Option<String>,
}

pub fn open_db(path: &std::path::Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("sqlite open: {e}"))?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS print_jobs (
          id TEXT PRIMARY KEY,
          branch_code TEXT NOT NULL,
          printer_id TEXT,
          printer_name TEXT,
          order_id TEXT,
          priority INTEGER NOT NULL DEFAULT 100,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 3,
          error TEXT,
          payload_json TEXT NOT NULL,
          device_label TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          printed_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status, priority, created_at);
        CREATE TABLE IF NOT EXISTS printers (
          id TEXT PRIMARY KEY,
          branch_code TEXT NOT NULL,
          name TEXT NOT NULL,
          windows_printer_name TEXT,
          ip_address TEXT,
          port INTEGER,
          connection_type TEXT NOT NULL DEFAULT 'other',
          online INTEGER NOT NULL DEFAULT 1,
          last_heartbeat_at TEXT
        );
        CREATE TABLE IF NOT EXISTS discovered_servers (
          id TEXT PRIMARY KEY,
          payload_json TEXT NOT NULL,
          last_seen_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS heartbeats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          payload_json TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| format!("sqlite migrate: {e}"))?;
    Ok(conn)
}

fn now_iso() -> String {
    // Simple UTC-ish timestamp without chrono crate.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

pub fn insert_job(
    conn: &Connection,
    id: &str,
    branch_code: &str,
    printer_id: Option<&str>,
    printer_name: Option<&str>,
    order_id: Option<&str>,
    priority: i32,
    payload_json: &str,
    device_label: Option<&str>,
) -> Result<(), String> {
    let ts = now_iso();
    conn.execute(
        r#"INSERT INTO print_jobs
        (id, branch_code, printer_id, printer_name, order_id, priority, status, retry_count, max_retries, payload_json, device_label, created_at, updated_at)
        VALUES (?1,?2,?3,?4,?5,?6,'pending',0,3,?7,?8,?9,?9)"#,
        params![
            id,
            branch_code,
            printer_id,
            printer_name,
            order_id,
            priority,
            payload_json,
            device_label,
            ts
        ],
    )
    .map_err(|e| format!("insert job: {e}"))?;
    Ok(())
}

fn map_job(row: &rusqlite::Row<'_>) -> Result<PrintJobRow, rusqlite::Error> {
    Ok(PrintJobRow {
        id: row.get(0)?,
        branch_code: row.get(1)?,
        printer_id: row.get(2)?,
        printer_name: row.get(3)?,
        order_id: row.get(4)?,
        priority: row.get(5)?,
        status: row.get(6)?,
        retry_count: row.get(7)?,
        error: row.get(8)?,
        payload_json: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
        printed_at: row.get(12)?,
    })
}

pub fn get_job(conn: &Connection, id: &str) -> Result<Option<PrintJobRow>, String> {
    let mut stmt = conn
        .prepare(
            r#"SELECT id, branch_code, printer_id, printer_name, order_id, priority, status, retry_count, error, payload_json, created_at, updated_at, printed_at
               FROM print_jobs WHERE id = ?1"#,
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        return Ok(Some(map_job(row).map_err(|e| e.to_string())?));
    }
    Ok(None)
}

pub fn list_jobs(
    conn: &Connection,
    branch_code: Option<&str>,
    limit: i64,
) -> Result<Vec<PrintJobRow>, String> {
    let sql = if branch_code.is_some() {
        r#"SELECT id, branch_code, printer_id, printer_name, order_id, priority, status, retry_count, error, payload_json, created_at, updated_at, printed_at
           FROM print_jobs WHERE branch_code = ?1 ORDER BY created_at DESC LIMIT ?2"#
    } else {
        r#"SELECT id, branch_code, printer_id, printer_name, order_id, priority, status, retry_count, error, payload_json, created_at, updated_at, printed_at
           FROM print_jobs ORDER BY created_at DESC LIMIT ?1"#
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mapped = if let Some(bc) = branch_code {
        let rows = stmt
            .query_map(params![bc, limit], |row| map_job(row))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    } else {
        let rows = stmt
            .query_map(params![limit], |row| map_job(row))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    Ok(mapped)
}

pub fn set_status(
    conn: &Connection,
    id: &str,
    status: &str,
    error: Option<&str>,
) -> Result<(), String> {
    let ts = now_iso();
    conn.execute(
        "UPDATE print_jobs SET status = ?1, error = ?2, updated_at = ?3 WHERE id = ?4",
        params![status, error, ts, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn claim_next_pending(conn: &Connection) -> Result<Option<PrintJobRow>, String> {
    let mut stmt = conn
        .prepare(
            r#"SELECT id FROM print_jobs
               WHERE status IN ('pending','retrying')
               ORDER BY priority ASC, created_at ASC LIMIT 1"#,
        )
        .map_err(|e| e.to_string())?;
    let id: Option<String> = stmt
        .query_row([], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    let Some(id) = id else {
        return Ok(None);
    };
    set_status(conn, &id, "printing", None)?;
    get_job(conn, &id)
}

pub fn mark_completed(conn: &Connection, id: &str) -> Result<(), String> {
    let ts = now_iso();
    conn.execute(
        "UPDATE print_jobs SET status = 'completed', error = NULL, printed_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![ts, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn mark_failed_or_retry(conn: &Connection, id: &str, error: &str) -> Result<(), String> {
    let job = get_job(conn, id)?.ok_or_else(|| "job not found".to_string())?;
    let retry = job.retry_count + 1;
    let ts = now_iso();
    // max_retries default 3 — read from DB via updated retry_count threshold
    let status = if retry >= 3 { "failed" } else { "retrying" };
    conn.execute(
        "UPDATE print_jobs SET status = ?1, retry_count = ?2, error = ?3, updated_at = ?4 WHERE id = ?5",
        params![status, retry, error, ts, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn count_by_status(conn: &Connection, status: &str) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM print_jobs WHERE status = ?1",
        params![status],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

pub fn count_printers(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM printers", [], |row| row.get(0))
        .map_err(|e| e.to_string())
}

pub fn upsert_printer(
    conn: &Connection,
    id: &str,
    branch_code: &str,
    name: &str,
    windows_printer_name: Option<&str>,
    ip_address: Option<&str>,
    port: Option<i32>,
    connection_type: &str,
    online: bool,
) -> Result<(), String> {
    let ts = now_iso();
    conn.execute(
        r#"INSERT INTO printers (id, branch_code, name, windows_printer_name, ip_address, port, connection_type, online, last_heartbeat_at)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name,
             windows_printer_name=excluded.windows_printer_name,
             ip_address=excluded.ip_address,
             port=excluded.port,
             connection_type=excluded.connection_type,
             online=excluded.online,
             last_heartbeat_at=excluded.last_heartbeat_at"#,
        params![
            id,
            branch_code,
            name,
            windows_printer_name,
            ip_address,
            port,
            connection_type,
            if online { 1 } else { 0 },
            ts
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_printers(conn: &Connection, branch_code: Option<&str>) -> Result<Vec<PrinterRow>, String> {
    let sql = if branch_code.is_some() {
        "SELECT id, branch_code, name, windows_printer_name, ip_address, port, connection_type, online, last_heartbeat_at FROM printers WHERE branch_code = ?1 ORDER BY name"
    } else {
        "SELECT id, branch_code, name, windows_printer_name, ip_address, port, connection_type, online, last_heartbeat_at FROM printers ORDER BY name"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let map = |row: &rusqlite::Row<'_>| -> Result<PrinterRow, rusqlite::Error> {
        let online_i: i64 = row.get(7)?;
        Ok(PrinterRow {
            id: row.get(0)?,
            branch_code: row.get(1)?,
            name: row.get(2)?,
            windows_printer_name: row.get(3)?,
            ip_address: row.get(4)?,
            port: row.get(5)?,
            connection_type: row.get(6)?,
            online: online_i != 0,
            last_heartbeat_at: row.get(8)?,
        })
    };
    let rows = if let Some(bc) = branch_code {
        stmt.query_map(params![bc], map)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    } else {
        stmt.query_map([], map)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    Ok(rows)
}

trait OptionalExt<T> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
