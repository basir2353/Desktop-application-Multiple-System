use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// RAW / ESC-POS over TCP (commonly port 9100).
#[tauri::command]
pub fn print_raw_tcp(
    host: String,
    port: Option<u16>,
    data_base64: String,
) -> Result<bool, String> {
    let port = port.unwrap_or(9100);
    let bytes = base64_decode(&data_base64).map_err(|e| format!("base64: {e}"))?;
    let addr = format!("{host}:{port}");
    let sock_addr = addr
        .to_socket_addrs()
        .map_err(|e| format!("resolve {addr}: {e}"))?
        .next()
        .ok_or_else(|| format!("no address for {addr}"))?;
    let mut stream = TcpStream::connect_timeout(&sock_addr, Duration::from_secs(5))
        .map_err(|e| format!("connect {addr}: {e}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| e.to_string())?;
    stream.write_all(&bytes).map_err(|e| format!("write: {e}"))?;
    let _ = stream.flush();
    Ok(true)
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // Minimal base64 decoder without extra crate.
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::new();
    let mut buf: u32 = 0;
    let mut bits: i32 = 0;
    for &c in input.as_bytes() {
        if c == b'=' || c.is_ascii_whitespace() {
            continue;
        }
        let val = TABLE
            .iter()
            .position(|&x| x == c)
            .ok_or_else(|| format!("invalid base64 char {}", c as char))? as u32;
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xff) as u8);
        }
    }
    Ok(out)
}
