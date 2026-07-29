//! Branch Print Server — local SQLite queue, LAN HTTP API, UDP discovery, raw TCP print.

pub mod db;
mod server;
pub mod discovery;
pub mod ip_print;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Manager, State};

static SERVER: OnceLock<Mutex<Option<server::BranchServerHandle>>> = OnceLock::new();

fn server_slot() -> &'static Mutex<Option<server::BranchServerHandle>> {
    SERVER.get_or_init(|| Mutex::new(None))
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchServerConfig {
    pub server_id: String,
    pub branch_code: String,
    pub branch_name: String,
    pub server_name: String,
    pub port: u16,
    #[serde(default)]
    pub organization_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchServerStatus {
    pub running: bool,
    pub server_id: String,
    pub branch_code: String,
    pub branch_name: String,
    pub server_name: String,
    pub local_ip: String,
    pub port: u16,
    pub queue_pending: i64,
    pub queue_failed: i64,
    pub printer_count: i64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueJobRequest {
    pub id: Option<String>,
    pub branch_code: String,
    pub printer_id: Option<String>,
    pub printer_name: Option<String>,
    pub order_id: Option<String>,
    pub priority: Option<i32>,
    pub payload_json: String,
    pub device_label: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintJobRow {
    pub id: String,
    pub branch_code: String,
    pub printer_id: Option<String>,
    pub printer_name: Option<String>,
    pub order_id: Option<String>,
    pub priority: i32,
    pub status: String,
    pub retry_count: i32,
    pub error: Option<String>,
    pub payload_json: String,
    pub created_at: String,
    pub updated_at: String,
    pub printed_at: Option<String>,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))
}

pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create app data: {e}"))?;
    Ok(dir.join("branch-print-queue.sqlite"))
}

#[tauri::command]
pub fn start_branch_print_server(
    app: AppHandle,
    config: BranchServerConfig,
) -> Result<BranchServerStatus, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    let local_ip = discovery::local_ipv4().unwrap_or_else(|| "127.0.0.1".into());

    let mut slot = server_slot().lock().map_err(|e| e.to_string())?;
    if let Some(existing) = slot.as_ref() {
        if existing.port == config.port {
            // Already listening — still ensure LAN firewall so phones can connect.
            server::ensure_firewall_for_port(config.port);
            return Ok(status_from_handle(existing, &conn)?);
        }
        existing.stop();
        *slot = None;
    }

    let handle = server::start(app.clone(), config.clone(), path, local_ip.clone())?;
    let status = BranchServerStatus {
        running: true,
        server_id: config.server_id.clone(),
        branch_code: config.branch_code.clone(),
        branch_name: config.branch_name.clone(),
        server_name: config.server_name.clone(),
        local_ip,
        port: config.port,
        queue_pending: db::count_by_status(&conn, "pending").unwrap_or(0),
        queue_failed: db::count_by_status(&conn, "failed").unwrap_or(0),
        printer_count: db::count_printers(&conn).unwrap_or(0),
    };
    *slot = Some(handle);
    Ok(status)
}

#[tauri::command]
pub fn stop_branch_print_server() -> Result<bool, String> {
    let mut slot = server_slot().lock().map_err(|e| e.to_string())?;
    if let Some(h) = slot.take() {
        h.stop();
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub fn get_branch_print_server_status(app: AppHandle) -> Result<BranchServerStatus, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    let slot = server_slot().lock().map_err(|e| e.to_string())?;
    if let Some(h) = slot.as_ref() {
        return status_from_handle(h, &conn);
    }
    Ok(BranchServerStatus {
        running: false,
        server_id: String::new(),
        branch_code: String::new(),
        branch_name: String::new(),
        server_name: String::new(),
        local_ip: discovery::local_ipv4().unwrap_or_else(|| "127.0.0.1".into()),
        port: 9740,
        queue_pending: db::count_by_status(&conn, "pending").unwrap_or(0),
        queue_failed: db::count_by_status(&conn, "failed").unwrap_or(0),
        printer_count: db::count_printers(&conn).unwrap_or(0),
    })
}

fn status_from_handle(
    h: &server::BranchServerHandle,
    conn: &rusqlite::Connection,
) -> Result<BranchServerStatus, String> {
    Ok(BranchServerStatus {
        running: true,
        server_id: h.config.server_id.clone(),
        branch_code: h.config.branch_code.clone(),
        branch_name: h.config.branch_name.clone(),
        server_name: h.config.server_name.clone(),
        local_ip: h.local_ip.clone(),
        port: h.port,
        queue_pending: db::count_by_status(conn, "pending").unwrap_or(0),
        queue_failed: db::count_by_status(conn, "failed").unwrap_or(0),
        printer_count: db::count_printers(conn).unwrap_or(0),
    })
}

#[tauri::command]
pub fn enqueue_branch_print_job(
    app: AppHandle,
    job: EnqueueJobRequest,
) -> Result<PrintJobRow, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    let id = job
        .id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    db::insert_job(
        &conn,
        &id,
        &job.branch_code,
        job.printer_id.as_deref(),
        job.printer_name.as_deref(),
        job.order_id.as_deref(),
        job.priority.unwrap_or(100),
        &job.payload_json,
        job.device_label.as_deref(),
    )?;
    db::get_job(&conn, &id)?.ok_or_else(|| "job missing after insert".into())
}

#[tauri::command]
pub fn list_branch_print_queue(
    app: AppHandle,
    branch_code: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<PrintJobRow>, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    db::list_jobs(&conn, branch_code.as_deref(), limit.unwrap_or(100))
}

#[tauri::command]
pub fn branch_print_queue_action(
    app: AppHandle,
    job_id: String,
    action: String,
) -> Result<PrintJobRow, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    match action.as_str() {
        "retry" | "reprint" => db::set_status(&conn, &job_id, "pending", None)?,
        "pause" => db::set_status(&conn, &job_id, "paused", None)?,
        "resume" => db::set_status(&conn, &job_id, "pending", None)?,
        "cancel" => db::set_status(&conn, &job_id, "cancelled", None)?,
        other => return Err(format!("unknown action: {other}")),
    }
    db::get_job(&conn, &job_id)?.ok_or_else(|| "job not found".into())
}

#[tauri::command]
pub fn upsert_branch_printer(
    app: AppHandle,
    id: String,
    branch_code: String,
    name: String,
    windows_printer_name: Option<String>,
    ip_address: Option<String>,
    port: Option<i32>,
    connection_type: Option<String>,
    online: Option<bool>,
) -> Result<(), String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    db::upsert_printer(
        &conn,
        &id,
        &branch_code,
        &name,
        windows_printer_name.as_deref(),
        ip_address.as_deref(),
        port,
        connection_type.as_deref().unwrap_or("other"),
        online.unwrap_or(true),
    )
}

#[tauri::command]
pub fn list_branch_printers(app: AppHandle, branch_code: Option<String>) -> Result<Vec<db::PrinterRow>, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    db::list_printers(&conn, branch_code.as_deref())
}

/// Shared state for optional frontend polling of next pending job (TS executes print).
pub struct PrintBridgeState {
    pub last_claim: Mutex<Option<String>>,
}

impl Default for PrintBridgeState {
    fn default() -> Self {
        Self {
            last_claim: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn claim_next_branch_print_job(
    app: AppHandle,
    _state: State<'_, Arc<PrintBridgeState>>,
) -> Result<Option<PrintJobRow>, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    let Some(job) = db::claim_next_pending(&conn)? else {
        return Ok(None);
    };
    Ok(Some(job))
}

#[tauri::command]
pub fn complete_branch_print_job(
    app: AppHandle,
    job_id: String,
    ok: bool,
    error: Option<String>,
) -> Result<PrintJobRow, String> {
    let path = db_path(&app)?;
    let conn = db::open_db(&path)?;
    if ok {
        db::mark_completed(&conn, &job_id)?;
    } else {
        db::mark_failed_or_retry(&conn, &job_id, error.as_deref().unwrap_or("print failed"))?;
    }
    db::get_job(&conn, &job_id)?.ok_or_else(|| "job not found".into())
}
