mod printing;

use printers::common::base::job::PrinterJobOptions;
use printers::common::base::printer::PrinterState;
use printers::{get_printer_by_name, get_printers};
use serde::Serialize;
use std::fs;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

/// Spawn helper processes without a console flash (Windows Terminal / cmd window).
fn command_no_window(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    cmd
}

#[derive(Serialize, Clone)]
struct SystemPrinterInfo {
    name: String,
    system_name: String,
    driver_name: String,
    port_name: String,
    is_default: bool,
    is_shared: bool,
    state: String,
    /// Fax / PDF / OneNote — badge only; still printable.
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
    let output = match command_no_window("powershell")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
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

fn merge_printer_lists(
    primary: Vec<SystemPrinterInfo>,
    extra: Vec<SystemPrinterInfo>,
) -> Vec<SystemPrinterInfo> {
    let mut out = primary;
    for printer in extra {
        if !out
            .iter()
            .any(|existing| existing.name.eq_ignore_ascii_case(&printer.name))
        {
            out.push(printer);
        }
    }
    out
}

/// Enumerates every printer Windows knows about (USB, network, shared, PDF/XPS).
#[tauri::command]
fn list_system_printers() -> Vec<SystemPrinterInfo> {
    let crate_list: Vec<SystemPrinterInfo> = get_printers()
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
    // Always merge Get-Printer so USB/network devices the crate misses still appear.
    merge_printer_lists(crate_list, list_printers_via_powershell())
}

fn escape_powershell_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

/// Build ESC/POS bytes for local restaurant thermal printers (Xprinter / Rongta / Epson clones).
/// Uses ASCII (+ '?' for non-ASCII) so RAW jobs do not garble like UTF-8 did.
fn build_escpos_bytes(content: &str) -> Vec<u8> {
    let mut out: Vec<u8> = Vec::with_capacity(content.len() + 32);
    // ESC @ — initialize
    out.extend_from_slice(&[0x1B, 0x40]);
    // ESC a 0 — left align (fills roll from the left edge)
    out.extend_from_slice(&[0x1B, 0x61, 0x00]);
    // ESC ! 0 — Font A, normal size
    out.extend_from_slice(&[0x1B, 0x21, 0x00]);
    // ESC 3 n — line spacing (tighter, less vertical stretch)
    out.extend_from_slice(&[0x1B, 0x33, 0x40]);

    for line in content.lines() {
        for ch in line.chars() {
            let b = if ch.is_ascii() && ch != '\0' {
                ch as u8
            } else {
                b'?'
            };
            out.push(b);
        }
        out.push(b'\n');
    }
    // Short feed then partial cut — long feeds leave a large blank on the *next* slip.
    out.extend_from_slice(&[0x0A, 0x0A]);
    out.extend_from_slice(&[0x1D, 0x56, 0x01]);
    out
}

fn print_raw_escpos(printer_name: &str, content: &str, job_name: &str) -> Result<u64, String> {
    let printer =
        find_printer(printer_name).ok_or_else(|| format!("Printer not found: {printer_name}"))?;
    let bytes = build_escpos_bytes(content);
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = std::env::temp_dir().join(format!("pops-escpos-{stamp}.bin"));
    fs::write(&temp_path, &bytes).map_err(|e| format!("Could not write ESC/POS temp: {e}"))?;
    let path_str = temp_path
        .to_str()
        .ok_or_else(|| "Temp print path is not valid UTF-8".to_string())?
        .to_string();

    let options = PrinterJobOptions {
        name: Some(job_name),
        raw_properties: &[("copies", "1"), ("document-format", "application/octet-stream")],
        ..PrinterJobOptions::none()
    };
    let result = printer.print_file(&path_str, options);
    let _ = fs::remove_file(&temp_path);
    match result {
        Ok(job_id) => Ok(job_id),
        Err(e) => Err(format!("ESC/POS raw print failed: {e:?}")),
    }
}

fn normalize_paper_width_mm(paper_width_mm: u32) -> u32 {
    match paper_width_mm {
        0..=47 => 48,
        48..=210 => paper_width_mm,
        _ => 210,
    }
}

fn mm_to_hundredths_inch(mm: u32) -> u32 {
    ((mm as f64 / 25.4) * 100.0).round().max(1.0) as u32
}

/// GDI PrintDocument with thermal paper width + small monospace font.
/// Fixes the classic Out-Printer problem: letter page + large font → huge L/R margins on 58/80mm.
fn print_via_gdi_thermal(printer_name: &str, path: &str, paper_width_mm: u32) -> Result<(), String> {
    let width_mm = normalize_paper_width_mm(paper_width_mm);
    // Hundredths of an inch (Windows PaperSize).
    let width_hi = mm_to_hundredths_inch(width_mm);
    // Continuous thermal roll (~3276mm). Avoid short 297mm forms that zoom text.
    let height_hi = 12897;
    // Larger bold type — readable on 203 DPI 80mm / 3" rolls.
    let font_pt = if width_mm <= 62 { 8.0 } else { 9.0 };

    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$printerName = '{printer}'
$path = '{path}'
$targetWidth = {width_hi}
$content = [System.IO.File]::ReadAllText($path)
$lines = $content -split "`r?`n"
$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $printerName
if (-not $doc.PrinterSettings.IsValid) {{ throw "Printer not valid: $printerName" }}
$doc.DocumentName = 'POPS Thermal'
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$paper = New-Object System.Drawing.Printing.PaperSize('POPS Thermal', {width_hi}, {height_hi})
try {{ $doc.DefaultPageSettings.PaperSize = $paper }} catch {{ }}
$exact = $null
foreach ($ps in $doc.PrinterSettings.PaperSizes) {{
  $w = [int]$ps.Width
  $h = [int]$ps.Height
  if ([math]::Abs($w - $targetWidth) -le 2 -and $h -ge 1000) {{
    $exact = $ps
    if ([string]$ps.PaperName -match '3276|GIANT') {{ break }}
  }}
}}
if ($exact -ne $null) {{
  $doc.DefaultPageSettings.PaperSize = $exact
}}
$doc.DefaultPageSettings.Landscape = $false
$font = New-Object System.Drawing.Font('Consolas', {font_pt}, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black
$script:idx = 0
$doc.add_PrintPage({{
  param($s, $e)
  $e.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Display
  $e.Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
  $lineH = [math]::Ceiling($font.GetHeight($e.Graphics))
  $x = 1.0
  $y = 0.0
  $maxY = $e.PageBounds.Height - 4
  while ($script:idx -lt $lines.Length) {{
    if (($y + $lineH) -gt $maxY -and $y -gt 0) {{
      $e.HasMorePages = $true
      return
    }}
    $e.Graphics.DrawString($lines[$script:idx], $font, $brush, $x, $y)
    $y += $lineH
    $script:idx++
  }}
  $e.HasMorePages = $false
}})
# Silent spool — no Windows "Printing / Page 1 of…" status dialog (that freezes the app).
$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$doc.Print()
$font.Dispose()
$doc.Dispose()
"#,
        printer = escape_powershell_single_quoted(printer_name),
        path = escape_powershell_single_quoted(path),
        width_hi = width_hi,
        height_hi = height_hi,
        font_pt = font_pt,
    );

    let output = command_no_window("powershell")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .output()
        .map_err(|e| format!("GDI thermal print failed to start: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "GDI thermal print failed: {}",
        stderr.trim().chars().take(280).collect::<String>()
    ))
}

/// Legacy Out-Printer fallback (works for PDF / XPS virtual printers).
fn print_via_out_printer(printer_name: &str, path: &str) -> Result<(), String> {
    let script = format!(
        "Get-Content -LiteralPath '{}' -Raw | Out-Printer -Name '{}'",
        escape_powershell_single_quoted(path),
        escape_powershell_single_quoted(printer_name)
    );
    let output = command_no_window("powershell")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
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
///
/// Physical thermal (Pakistan restaurant 58/80mm):
///   1) ESC/POS RAW — fills roll edge-to-edge
///   2) GDI PrintDocument with thermal PaperSize + Consolas — no A4 margins
///   3) Out-Printer / text spooler fallback
///
/// Virtual PDF/XPS: Out-Printer first (Save dialog works).
fn print_to_printer_sync(
    printer_name: String,
    content: String,
    job_name: Option<String>,
    copies: Option<u32>,
    paper_width_mm: Option<u32>,
) -> Result<u64, String> {
    let printer =
        find_printer(&printer_name).ok_or_else(|| format!("Printer not found: {printer_name}"))?;

    let copies = copies.unwrap_or(1).max(1);
    let job_label = job_name.unwrap_or_else(|| "POPS Print".to_string());
    let paper_mm = paper_width_mm.unwrap_or(80).max(40);
    let virtual_target = is_virtual_printer(
        &printer.name,
        &printer.driver_name,
        &printer.port_name,
    );

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = std::env::temp_dir().join(format!("pops-print-{stamp}.txt"));
    // UTF-8 BOM helps GDI / Out-Printer; ESC/POS path uses its own ASCII conversion.
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

    let mut last_job_id = 0u64;
    let mut last_err = String::new();

    for i in 0..copies {
        let name = if copies > 1 {
            format!("{job_label} ({}/{})", i + 1, copies)
        } else {
            job_label.clone()
        };

        let mut printed = false;

        if !virtual_target {
            // 1) GDI with correct roll width — fixes left/right empty margins on 58/80mm.
            // Prefer this before RAW: some drivers accept RAW and return Ok while printing garbage.
            match print_via_gdi_thermal(&printer_name, &path_str, paper_mm) {
                Ok(()) => {
                    last_job_id = 1;
                    printed = true;
                }
                Err(e) => last_err = e,
            }
            // 2) ESC/POS RAW — good for Xprinter / Rongta / Epson-clone USB when GDI fails.
            if !printed {
                if let Ok(job_id) = print_raw_escpos(&printer_name, &content, &name) {
                    last_job_id = job_id;
                    printed = true;
                }
            }
        }

        // 3) Out-Printer — PDF/XPS and last-resort for odd drivers.
        if !printed {
            match print_via_out_printer(&printer_name, &path_str) {
                Ok(()) => {
                    last_job_id = 1;
                    printed = true;
                }
                Err(e) => last_err = e,
            }
        }

        // 4) Text spooler.
        if !printed {
            let options = PrinterJobOptions {
                name: Some(name.as_str()),
                raw_properties: &[("copies", "1"), ("document-format", "text/plain")],
                ..PrinterJobOptions::none()
            };
            match printer.print_file(&path_str, options) {
                Ok(job_id) => {
                    last_job_id = job_id;
                    printed = true;
                }
                Err(text_err) => {
                    last_err = format!("text spooler failed ({text_err:?}); last={last_err}");
                }
            }
        }

        if !printed {
            let _ = fs::remove_file(&temp_path);
            return Err(format!("Print failed on {printer_name}: {last_err}"));
        }
    }

    let _ = fs::remove_file(&temp_path);
    Ok(last_job_id)
}

/// Async wrapper — PowerShell print must not block the UI/WebView thread.
#[tauri::command]
async fn print_to_printer(
    printer_name: String,
    content: String,
    job_name: Option<String>,
    copies: Option<u32>,
    paper_width_mm: Option<u32>,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        print_to_printer_sync(printer_name, content, job_name, copies, paper_width_mm)
    })
    .await
    .map_err(|e| format!("Print task failed: {e}"))?
}

/// Prints a PNG to a named OS printer via GDI — preserves styled HTML receipt layout.
fn print_image_to_printer_sync(
    printer_name: String,
    png_bytes: Vec<u8>,
    job_name: Option<String>,
    copies: Option<u32>,
    paper_width_mm: Option<u32>,
) -> Result<u64, String> {
    let _printer =
        find_printer(&printer_name).ok_or_else(|| format!("Printer not found: {printer_name}"))?;

    if png_bytes.is_empty() {
        return Err("PNG image was empty.".to_string());
    }

    let copies = copies.unwrap_or(1).max(1);
    let job_label = job_name.unwrap_or_else(|| "POPS Receipt".to_string());
    let paper_mm = paper_width_mm.unwrap_or(80).max(40);

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_path = std::env::temp_dir().join(format!("pops-receipt-{stamp}.png"));
    fs::write(&temp_path, &png_bytes).map_err(|e| format!("Could not write temp PNG: {e}"))?;
    let path_str = temp_path
        .to_str()
        .ok_or_else(|| "Temp PNG path is not valid UTF-8".to_string())?
        .to_string();

    match print_via_gdi_image(&printer_name, &path_str, paper_mm, &job_label, copies) {
        Ok(()) => {
            let _ = fs::remove_file(&temp_path);
            Ok(1)
        }
        Err(e) => {
            let _ = fs::remove_file(&temp_path);
            Err(e)
        }
    }
}

/// Async wrapper — PowerShell/GDI print must not block the UI/WebView thread.
#[tauri::command]
async fn print_image_to_printer(
    printer_name: String,
    png_bytes: Vec<u8>,
    job_name: Option<String>,
    copies: Option<u32>,
    paper_width_mm: Option<u32>,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        print_image_to_printer_sync(printer_name, png_bytes, job_name, copies, paper_width_mm)
    })
    .await
    .map_err(|e| format!("Print task failed: {e}"))?
}

fn print_via_gdi_image(
    printer_name: &str,
    png_path: &str,
    paper_width_mm: u32,
    job_name: &str,
    copies: u32,
) -> Result<(), String> {
    let width_mm = normalize_paper_width_mm(paper_width_mm);
    // Hundredths of an inch.
    let width_hi = mm_to_hundredths_inch(width_mm);
    // Extra blank after the last line so the thermal cutter does not slice "Net Total".
    let bottom_feed_hi = mm_to_hundredths_inch(14);

    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$printerName = '{printer}'
$path = '{path}'
$jobName = '{job}'
$copies = {copies}
$widthHi = {width_hi}
$bottomFeedHi = {bottom_feed_hi}
$img = [System.Drawing.Image]::FromFile($path)
try {{
  # One continuous slip: paper height = image height (scaled) + cutter feed.
  # Multi-page GDI jobs make the driver cut mid-receipt ("Net Total" half on next page).
  $scale = $widthHi / [double][math]::Max(1, $img.Width)
  $contentH = [math]::Max(1, [math]::Ceiling($img.Height * $scale))
  $paperH = [math]::Min(12897, $contentH + $bottomFeedHi)
  for ($c = 1; $c -le $copies; $c++) {{
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $printerName
    if (-not $doc.PrinterSettings.IsValid) {{ throw "Printer not valid: $printerName" }}
    $doc.DocumentName = if ($copies -gt 1) {{ "$jobName ($c/$copies)" }} else {{ $jobName }}
    $doc.PrinterSettings.Copies = 1
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    $paper = New-Object System.Drawing.Printing.PaperSize('POPS Receipt', $widthHi, [int]$paperH)
    try {{ $doc.DefaultPageSettings.PaperSize = $paper }} catch {{ }}
    $doc.DefaultPageSettings.Landscape = $false
    $doc.add_PrintPage({{
      param($s, $e)
      $e.Graphics.PageUnit = [System.Drawing.GraphicsUnit]::Display
      $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $e.Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
      $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
      $originX = [math]::Max(0, -$e.PageSettings.HardMarginX)
      $originY = [math]::Max(0, -$e.PageSettings.HardMarginY)
      $pageW = [math]::Max(1, $e.PageBounds.Width - 1)
      $drawW = [int]$widthHi
      if ($drawW -gt $pageW) {{ $drawW = $pageW }}
      if ($drawW -lt 1) {{ $drawW = $pageW }}
      $drawScale = $drawW / [double][math]::Max(1, $img.Width)
      $drawH = [math]::Ceiling($img.Height * $drawScale)
      $x = [int]($originX + [math]::Max(0, ($pageW - $drawW) / 2))
      $destRect = New-Object System.Drawing.Rectangle($x, [int]$originY, [int]$drawW, [int]$drawH)
      $e.Graphics.DrawImage($img, $destRect)
      # Never paginate — thermal auto-cut between pages slices the last lines.
      $e.HasMorePages = $false
    }})
    # Silent spool — no Windows "Printing / Page 1 of…" status dialog (that freezes the app).
    $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
    $doc.Print()
    $doc.Dispose()
  }}
}} finally {{
  $img.Dispose()
}}
"#,
        printer = escape_powershell_single_quoted(printer_name),
        path = escape_powershell_single_quoted(png_path),
        job = escape_powershell_single_quoted(job_name),
        copies = copies,
        width_hi = width_hi,
        bottom_feed_hi = bottom_feed_hi,
    );

    let output = command_no_window("powershell")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .output()
        .map_err(|e| format!("GDI image print failed to start: {e}"))?;
    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(format!(
        "GDI image print failed: {}",
        stderr.trim().chars().take(280).collect::<String>()
    ))
}

#[derive(serde::Serialize)]
struct PraHttpPostResult {
    status: u16,
    body: String,
}

#[tauri::command]
fn pra_http_post(url: String, token: String, body: String) -> Result<PraHttpPostResult, String> {
    if !(url.starts_with("https://ims.pral.com.pk/") || url.starts_with("https://ims.pral.com.pk")) {
        return Err("PRA URL host is not allowed".into());
    }
    let resp = ureq::post(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(45))
        .send_string(&body)
        .map_err(|e| {
            format!(
                "PRA network error: {e}. POPS cloud is OK — this PC could not complete HTTPS to ims.pral.com.pk (firewall, PRA downtime, or TLS)."
            )
        })?;
    let status = resp.status();
    let body = resp
        .into_string()
        .map_err(|e| format!("PRA response read failed: {e}"))?;
    Ok(PraHttpPostResult { status, body })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Arc::new(printing::PrintBridgeState::default()))
        .invoke_handler(tauri::generate_handler![
            list_system_printers,
            print_to_printer,
            print_image_to_printer,
            pra_http_post,
            printing::start_branch_print_server,
            printing::stop_branch_print_server,
            printing::get_branch_print_server_status,
            printing::enqueue_branch_print_job,
            printing::list_branch_print_queue,
            printing::branch_print_queue_action,
            printing::upsert_branch_printer,
            printing::list_branch_printers,
            printing::claim_next_branch_print_job,
            printing::complete_branch_print_job,
            printing::discovery::discover_branch_print_servers,
            printing::discovery::get_local_lan_ip,
            printing::ip_print::print_raw_tcp
        ])
        .setup(|app| {
            // Auto-start branch print server so mobile can discover this PC.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(800));
                let config = printing::BranchServerConfig {
                    server_id: "bps_auto".into(),
                    branch_code: "MAIN".into(),
                    branch_name: "Branch".into(),
                    server_name: "Branch Print Server".into(),
                    port: 9740,
                    organization_id: None,
                };
                match printing::start_branch_print_server(handle, config) {
                    Ok(st) => eprintln!(
                        "[branch-print] auto-started on {}:{}",
                        st.local_ip, st.port
                    ),
                    Err(e) => eprintln!("[branch-print] auto-start skipped: {e}"),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run tauri application");
}
