use printers::common::base::printer::PrinterState;
use serde::Serialize;

#[derive(Serialize, Clone)]
struct SystemPrinterInfo {
    name: String,
    system_name: String,
    driver_name: String,
    port_name: String,
    is_default: bool,
    is_shared: bool,
    state: String,
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

/// Enumerates printers installed on the OS (Windows Print Spooler / CUPS).
#[tauri::command]
fn list_system_printers() -> Vec<SystemPrinterInfo> {
    printers::get_printers()
        .into_iter()
        .map(|p| SystemPrinterInfo {
            name: p.name.clone(),
            system_name: p.system_name.clone(),
            driver_name: p.driver_name.clone(),
            port_name: p.port_name.clone(),
            is_default: p.is_default,
            is_shared: p.is_shared,
            state: printer_state_label(&p.state).to_string(),
        })
        .collect()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![list_system_printers])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
