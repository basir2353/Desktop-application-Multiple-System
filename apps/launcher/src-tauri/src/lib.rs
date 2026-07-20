use printers::common::base::job::PrinterJobOptions;
use printers::common::base::printer::PrinterState;
use printers::{get_printer_by_name, get_printers};
use serde::Serialize;
use std::fs;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Clone)]
struct SystemPrinterInfo {
    name: String,
    system_name: String,
    driver_name: String,
    port_name: String,
    is_default: bool,
    is_shared: bool,
    state: String,
    /// Fax / PDF / OneNote — shown in UI but not assignable for POS tickets.
    is_virtual: bool,
}

#[derive(serde::Deserialize)]
struct PsPrinterRow {
    #[serde(alias = "Name")]
    name: Option<String>,
    #[serde(alias = "DriverName")]
    driver_name: Option<String>,
    #[serde(alias = "PortName")]
    port_name: Option<String>,
    #[serde(alias = "Shared")]
    shared: Option<bool>,
    #[serde(alias = "Default")]
    default: Option<bool>,
    #[serde(alias = "PrinterStatus")]
    printer_status: Option<u32>,
}

fn printer_state_label(state: &PrinterState) -> &'static str {
    match state {
        PrinterState::READY => "ready",
        PrinterState::OFFLINE => "offline",
        PrinterState::PAUSED => "paused",
        PrinterState::PRINTING => "printing",
        PrinterState::UNKNOWN => "unknown",
    }
}

fn is_virtual_printer(name: &str, driver: &str, port: &str) -> bool {
    let hay = format!("{name} {driver} {port}").to_ascii_lowercase();
    let needles = [
        "fax",
        "microsoft print to pdf",
        "microsoft xps",
        "onenote",
        "adobe pdf",
        "foxit pdf",
        "cutepdf",
        "pdf creator",
        "pdf24",
        "print to file",
    ];
    needles.iter().any(|n| hay.contains(n))
        || port.eq_ignore_ascii_case("nul:")
        || port.eq_ignore_ascii_case("file:")
        || port.eq_ignore_ascii_case("portprompt:")
}

fn find_printer(printer_name: &str) -> Option<printers::common::base::printer::Printer> {
    get_printer_by_name(printer_name).or_else(|| {
        get_printers().into_iter().find(|p| {
            p.name.eq_ignore_ascii_case(printer_name) || p.system_name.eq_ignore_ascii_case(printer_name)
        })
    })
}

fn list_printers_via_powershell() -> Vec<SystemPrinterInfo> {
    let script = r#"
$ErrorActionPreference = 'Stop'
Get-Printer | Select-Object Name, DriverName, PortName, Shared, Default, PrinterStatus |
  ConvertTo-Json -Compress
"#;
    let output = match Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() || text == "null" {
        return Vec::new();
    }
    let rows: Vec<PsPrinterRow> = if text.starts_with('[') {
        serde_json::from_str(&text).unwrap_or_default()
    } else {
        serde_json::from_str::<PsPrinterRow>(&text)
            .map(|row| vec![row])
            .unwrap_or_default()
    };
    rows.into_iter()
        .filter_map(|row| {
            let name = row.name?.trim().to_string();
            if name.is_empty() {
                return None;
            }
            let driver = row.driver_name.unwrap_or_default();
            let port = row.port_name.unwrap_or_default();
            let is_virtual = is_virtual_printer(&name, &driver, &port);
            let state = match row.printer_status.unwrap_or(0) {
                0 | 3 => "ready",
                1 | 2 => "paused",
                4 | 5 => "printing",
                6 | 7 => "offline",
                _ => "unknown",
            };
            Some(SystemPrinterInfo {
                name: name.clone(),
                system_name: name,
                driver_name: driver,
                port_name: port,
                is_default: row.default.unwrap_or(false),
                is_shared: row.shared.unwrap_or(false),
                state: state.to_string(),
                is_virtual,
            })
        })
        .collect()
}

/// Enumerates printers installed on the OS (Windows Print Spooler / CUPS).
/// Includes virtual devices with `is_virtual` so the UI can explain why Fax/PDF are skipped.
#[tauri::command]
fn list_system_printers() -> Vec<SystemPrinterInfo> {
    let mut printers: Vec<SystemPrinterInfo> = get_printers()
        .into_iter()
        .map(|p| SystemPrinterInfo {
            name: p.name.clone(),
            system_name: p.system_name.clone(),
            driver_name: p.driver_name.clone(),
            port_name: p.port_name.clone(),
            is_default: p.is_default,
            is_shared: p.is_shared,
            state: printer_state_label(&p.state).to_string(),
            is_virtual: is_virtual_printer(&p.name, &p.driver_name, &p.port_name),
        })
        .collect();

    if printers.is_empty() {
        printers = list_printers_via_powershell();
    }
    printers
}

fn escape_powershell_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

/// Fallback for drivers that reject StartDocPrinterW from the printers crate.
fn print_via_powershell(printer_name: &str, path: &str) -> Result<(), String> {
    let script = format!(
        "Get-Content -LiteralPath '{}' -Raw | Out-Printer -Name '{}'",
        escape_powershell_single_quoted(path),
        escape_powershell_single_quoted(printer_name)
    );
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("PowerShell print failed to start: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "PowerShell Out-Printer failed: {}",
        stderr.trim().chars().take(240).collect::<String>()
    ))
}

/// Sends plain-text content directly to a named OS printer (no print dialog).
/// Writes a temp .txt file and prints it as TEXT so Windows GDI drivers accept the job.
#[tauri::command]
fn print_to_printer(
    printer_name: String,
    content: String,
    job_name: Option<String>,
    copies: Option<u32>,
) -> Result<u64, String> {
    if is_virtual_printer(&printer_name, "", "") {
        return Err(format!(
            "\"{printer_name}\" is a virtual Windows printer (Fax/PDF). Link a real kitchen/receipt printer in Printer → Profiles."
        ));
    }

    let printer =
        find_printer(&printer_name).ok_or_else(|| format!("Printer not found: {printer_name}"))?;

    if is_virtual_printer(&printer.name, &printer.driver_name, &printer.port_name) {
        return Err(format!(
            "\"{}\" is a virtual Windows printer (Fax/PDF). Link a real kitchen/receipt printer in Printer → Profiles.",
            printer.name
        ));
    }

    let copies = copies.unwrap_or(1).max(1);
    let job_label = job_name.unwrap_or_else(|| "POPS Print".to_string());
    let mut last_job_id = 0u64;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = std::env::temp_dir().join(format!("pops-print-{stamp}.txt"));
    // UTF-8 BOM helps Notepad/GDI text printers on Windows.
    let mut bytes = vec![0xEFu8, 0xBB, 0xBF];
    bytes.extend_from_slice(content.as_bytes());
    if !content.ends_with('\n') {
        bytes.push(b'\n');
    }
    fs::write(&temp_path, &bytes).map_err(|e| format!("Could not write temp print file: {e}"))?;

    let path_str = temp_path
        .to_str()
        .ok_or_else(|| "Temp print path is not valid UTF-8".to_string())?
        .to_string();

    for i in 0..copies {
        let name = if copies > 1 {
            format!("{job_label} ({}/{})", i + 1, copies)
        } else {
            job_label.clone()
        };
        let options = PrinterJobOptions {
            name: Some(name.as_str()),
            raw_properties: &[("copies", "1"), ("document-format", "text/plain")],
            ..PrinterJobOptions::none()
        };

        // Prefer print_file (TEXT) → raw bytes → PowerShell Out-Printer.
        let result = printer.print_file(&path_str, options).or_else(|_| {
            let options = PrinterJobOptions {
                name: Some(name.as_str()),
                raw_properties: &[("document-format", "text/plain")],
                ..PrinterJobOptions::none()
            };
            printer.print(content.as_bytes(), options)
        });

        match result {
            Ok(job_id) => last_job_id = job_id,
            Err(crate_err) => {
                print_via_powershell(&printer_name, &path_str).map_err(|shell_err| {
                    format!(
                        "Print failed on {printer_name}: {crate_err:?}. Fallback: {shell_err}"
                    )
                })?;
                last_job_id = 1;
            }
        }
    }

    let _ = fs::remove_file(&temp_path);
    Ok(last_job_id)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![list_system_printers, print_to_printer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
