use crate::printing::{db, BranchServerConfig};
use serde_json::json;
use std::net::UdpSocket;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::AppHandle;
use tiny_http::{Header, Method, Response, Server, StatusCode};

pub struct BranchServerHandle {
    pub config: BranchServerConfig,
    pub local_ip: String,
    pub port: u16,
    stop: Arc<AtomicBool>,
    _http: JoinHandle<()>,
    _udp: JoinHandle<()>,
}

impl BranchServerHandle {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

pub fn start(
    _app: AppHandle,
    config: BranchServerConfig,
    db_path: PathBuf,
    local_ip: String,
) -> Result<BranchServerHandle, String> {
    let port = if config.port == 0 { 9740 } else { config.port };
    // Don't pre-bind — tiny_http bind is the source of truth (avoids Windows port race).

    let stop = Arc::new(AtomicBool::new(false));
    let stop_http = Arc::clone(&stop);
    let stop_udp = Arc::clone(&stop);
    let cfg_http = config.clone();
    let cfg_udp = config.clone();
    let ip_http = local_ip.clone();
    let ip_udp = local_ip.clone();
    let db_http = db_path.clone();

    let ready = Arc::new(AtomicBool::new(false));
    let ready_flag = Arc::clone(&ready);
    let start_err: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let start_err_http = Arc::clone(&start_err);

    let http = thread::spawn(move || {
        let server = match Server::http(format!("0.0.0.0:{port}")) {
            Ok(s) => {
                ready_flag.store(true, Ordering::SeqCst);
                s
            }
            Err(e) => {
                if let Ok(mut g) = start_err_http.lock() {
                    *g = Some(format!("HTTP listen {port}: {e}"));
                }
                eprintln!("[branch-print] http listen failed: {e}");
                return;
            }
        };
        server.unblock();
        while !stop_http.load(Ordering::SeqCst) {
            match server.recv_timeout(Duration::from_millis(400)) {
                Ok(Some(mut req)) => {
                    let method = req.method().clone();
                    let url = req.url().to_string();
                    let body = {
                        let mut buf = Vec::new();
                        let _ = std::io::Read::read_to_end(&mut req.as_reader(), &mut buf);
                        String::from_utf8_lossy(&buf).to_string()
                    };
                    let resp = handle_request(&db_http, &cfg_http, &ip_http, port, &method, &url, &body);
                    let _ = req.respond(resp);
                }
                Ok(None) => {}
                Err(_) => {}
            }
        }
    });

    // Wait briefly for listen success/fail
    for _ in 0..40 {
        if ready.load(Ordering::SeqCst) {
            break;
        }
        if let Ok(g) = start_err.lock() {
            if g.is_some() {
                break;
            }
        }
        thread::sleep(Duration::from_millis(25));
    }
    if let Ok(g) = start_err.lock() {
        if let Some(err) = g.clone() {
            stop.store(true, Ordering::SeqCst);
            let _ = http.join();
            return Err(err);
        }
    }
    if !ready.load(Ordering::SeqCst) {
        stop.store(true, Ordering::SeqCst);
        let _ = http.join();
        return Err(format!("Branch print server failed to bind port {port}"));
    }

    let udp = thread::spawn(move || {
        let sock = match UdpSocket::bind("0.0.0.0:9741") {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[branch-print] udp bind failed (discover limited): {e}");
                return;
            }
        };
        let _ = sock.set_broadcast(true);
        let _ = sock.set_read_timeout(Some(Duration::from_millis(500)));
        let mut buf = [0u8; 1024];
        while !stop_udp.load(Ordering::SeqCst) {
            match sock.recv_from(&mut buf) {
                Ok((n, peer)) => {
                    let msg = String::from_utf8_lossy(&buf[..n]);
                    if msg.contains("POPS_PRINT_DISCOVER_v1") {
                        let payload = json!({
                            "magic": "POPS_PRINT_DISCOVER_v1",
                            "id": cfg_udp.server_id,
                            "branchCode": cfg_udp.branch_code,
                            "branchName": cfg_udp.branch_name,
                            "serverName": cfg_udp.server_name,
                            "localIp": ip_udp,
                            "port": port,
                            "status": "online",
                        })
                        .to_string();
                        let _ = sock.send_to(payload.as_bytes(), peer);
                    }
                }
                Err(_) => {}
            }
        }
    });

    Ok(BranchServerHandle {
        config,
        local_ip,
        port,
        stop,
        _http: http,
        _udp: udp,
    })
}

fn json_response(status: u16, body: String) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut resp = Response::from_string(body).with_status_code(StatusCode(status));
    if let Ok(h) = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]) {
        resp.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]) {
        resp.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(
        &b"Access-Control-Allow-Methods"[..],
        &b"GET,POST,OPTIONS"[..],
    ) {
        resp.add_header(h);
    }
    if let Ok(h) = Header::from_bytes(
        &b"Access-Control-Allow-Headers"[..],
        &b"Content-Type"[..],
    ) {
        resp.add_header(h);
    }
    resp
}

fn handle_request(
    db_path: &PathBuf,
    config: &BranchServerConfig,
    local_ip: &str,
    port: u16,
    method: &Method,
    url: &str,
    body: &str,
) -> Response<std::io::Cursor<Vec<u8>>> {
    if *method == Method::Options {
        return json_response(204, String::new());
    }

    let path = url.split('?').next().unwrap_or(url);
    let conn = match db::open_db(db_path) {
        Ok(c) => c,
        Err(e) => return json_response(500, json!({ "error": e }).to_string()),
    };

    if *method == Method::Get && path == "/health" {
        return json_response(
            200,
            json!({
                "ok": true,
                "serverId": config.server_id,
                "branchCode": config.branch_code,
                "branchName": config.branch_name,
                "serverName": config.server_name,
                "localIp": local_ip,
                "port": port,
            })
            .to_string(),
        );
    }

    if *method == Method::Get && path == "/v1/status" {
        let pending = db::count_by_status(&conn, "pending").unwrap_or(0);
        let failed = db::count_by_status(&conn, "failed").unwrap_or(0);
        let printers = db::count_printers(&conn).unwrap_or(0);
        return json_response(
            200,
            json!({
                "serverId": config.server_id,
                "branchCode": config.branch_code,
                "branchName": config.branch_name,
                "serverName": config.server_name,
                "localIp": local_ip,
                "port": port,
                "status": "online",
                "queuePending": pending,
                "queueFailed": failed,
                "printerCount": printers,
            })
            .to_string(),
        );
    }

    if *method == Method::Get && path == "/v1/queue" {
        match db::list_jobs(&conn, Some(&config.branch_code), 100) {
            Ok(jobs) => return json_response(200, serde_json::to_string(&jobs).unwrap_or_else(|_| "[]".into())),
            Err(e) => return json_response(500, json!({ "error": e }).to_string()),
        }
    }

    if *method == Method::Get && path == "/v1/printers" {
        match db::list_printers(&conn, Some(&config.branch_code)) {
            Ok(rows) => return json_response(200, serde_json::to_string(&rows).unwrap_or_else(|_| "[]".into())),
            Err(e) => return json_response(500, json!({ "error": e }).to_string()),
        }
    }

    if *method == Method::Post && path == "/v1/print-job" {
        let parsed: serde_json::Value = serde_json::from_str(body).unwrap_or(json!({}));
        let id = parsed
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let branch_code = parsed
            .get("branchCode")
            .and_then(|v| v.as_str())
            .unwrap_or(&config.branch_code);
        let payload = parsed
            .get("payload")
            .cloned()
            .unwrap_or_else(|| parsed.clone());
        let payload_json = payload.to_string();
        if let Err(e) = db::insert_job(
            &conn,
            &id,
            branch_code,
            parsed.get("printerId").and_then(|v| v.as_str()),
            parsed.get("printerName").and_then(|v| v.as_str()),
            parsed.get("orderId").and_then(|v| v.as_str()),
            parsed
                .get("priority")
                .and_then(|v| v.as_i64())
                .unwrap_or(100) as i32,
            &payload_json,
            parsed.get("deviceLabel").and_then(|v| v.as_str()),
        ) {
            return json_response(500, json!({ "error": e }).to_string());
        }
        match db::get_job(&conn, &id) {
            Ok(Some(job)) => {
                return json_response(201, serde_json::to_string(&job).unwrap_or_else(|_| "{}".into()))
            }
            Ok(None) => return json_response(500, json!({ "error": "missing" }).to_string()),
            Err(e) => return json_response(500, json!({ "error": e }).to_string()),
        }
    }

    if *method == Method::Post && path.starts_with("/v1/queue/") {
        let rest = path.trim_start_matches("/v1/queue/");
        let parts: Vec<&str> = rest.split('/').collect();
        if parts.len() == 2 {
            let job_id = parts[0];
            let action = parts[1];
            let status = match action {
                "retry" | "reprint" | "resume" => "pending",
                "pause" => "paused",
                "cancel" => "cancelled",
                _ => {
                    return json_response(400, json!({ "error": "bad action" }).to_string());
                }
            };
            if let Err(e) = db::set_status(&conn, job_id, status, None) {
                return json_response(500, json!({ "error": e }).to_string());
            }
            match db::get_job(&conn, job_id) {
                Ok(Some(job)) => {
                    return json_response(200, serde_json::to_string(&job).unwrap_or_else(|_| "{}".into()))
                }
                _ => return json_response(404, json!({ "error": "not found" }).to_string()),
            }
        }
    }

    json_response(404, json!({ "error": "not found" }).to_string())
}
