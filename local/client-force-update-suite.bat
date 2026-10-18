@echo off
setlocal EnableExtensions
REM IN-PLACE UPDATE for POPS Universal suite (same folder overwrite).

set "TAG=desktop-v0.3.106"
set "EXE=POPS-Universal-Management-System_0.3.106_x64-setup.exe"
set "URL=https://github.com/basir2353/pops-desktop-updates/releases/download/%TAG%/%EXE%"
set "OUT=%TEMP%\%EXE%"

echo.
echo ============================================================
echo  POPS Universal — Update EXISTING EXE (same folder)
echo ============================================================
echo.
echo [1/4] Closing app if open...
taskkill /IM "POPS Universal Management System.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Downloading...
echo      %URL%
where curl >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%OUT%' -UseBasicParsing"
) else (
  curl.exe -L --fail --retry 5 --retry-delay 2 -o "%OUT%" "%URL%"
)
if errorlevel 1 (
  echo DOWNLOAD FAILED.
  start "" "%URL%"
  pause
  exit /b 1
)

echo [3/4] Opening installer — Finish dabao...
start /wait "" "%OUT%"
set "EC=%ERRORLEVEL%"
echo.
if "%EC%"=="0" (
  echo Done. Start the app — version should be 0.3.106+.
) else (
  echo Manual: double-click %OUT%
)
echo.
pause
exit /b %EC%
