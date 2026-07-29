use serde::{Deserialize, Serialize};
use std::net::UdpSocket;
use std::time::Duration;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredServer {
    pub id: String,
    pub branch_code: String,
    pub branch_name: String,
    pub server_name: String,
    pub local_ip: String,
    pub port: u16,
    pub status: String,
    pub ping_ms: Option<u64>,
}

pub fn local_ipv4() -> Option<String> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|a| a.ip().to_string())
}

#[tauri::command]
pub fn get_local_lan_ip() -> Result<String, String> {
    Ok(local_ipv4().unwrap_or_else(|| "127.0.0.1".into()))
}

#[tauri::command]
pub fn discover_branch_print_servers(timeout_ms: Option<u64>) -> Result<Vec<DiscoveredServer>, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(1500));
    let sock = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    sock.set_broadcast(true).map_err(|e| e.to_string())?;
    sock.set_read_timeout(Some(Duration::from_millis(200)))
        .map_err(|e| e.to_string())?;

    let magic = b"POPS_PRINT_DISCOVER_v1";
    let _ = sock.send_to(magic, "255.255.255.255:9741");
    // Also probe common LAN broadcast patterns via local IP
    if let Some(ip) = local_ipv4() {
        if let Some(prefix) = ip.rsplit_once('.') {
            let bcast = format!("{}.255:9741", prefix.0);
            let _ = sock.send_to(magic, &bcast);
        }
    }

    let started = std::time::Instant::now();
    let mut found: Vec<DiscoveredServer> = Vec::new();
    let mut buf = [0u8; 2048];
    while started.elapsed() < timeout {
        match sock.recv_from(&mut buf) {
            Ok((n, _peer)) => {
                let text = String::from_utf8_lossy(&buf[..n]);
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    let id = v
                        .get("id")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    if id.is_empty() {
                        continue;
                    }
                    if found.iter().any(|s| s.id == id) {
                        continue;
                    }
                    found.push(DiscoveredServer {
                        id,
                        branch_code: v
                            .get("branchCode")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string(),
                        branch_name: v
                            .get("branchName")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string(),
                        server_name: v
                            .get("serverName")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string(),
                        local_ip: v
                            .get("localIp")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string(),
                        port: v.get("port").and_then(|x| x.as_u64()).unwrap_or(9740) as u16,
                        status: v
                            .get("status")
                            .and_then(|x| x.as_str())
                            .unwrap_or("online")
                            .to_string(),
                        ping_ms: Some(started.elapsed().as_millis() as u64),
                    });
                }
            }
            Err(_) => {}
        }
    }
    Ok(found)
}
