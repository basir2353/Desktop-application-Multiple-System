@echo off
setlocal EnableExtensions
REM One-time in-place update for Suite clients stuck on "different key" at ~99%.

set "TAG=desktop-v0.3.100"
set "EXE=POPS-Universal-Management-System_0.3.100_x64-setup.exe"
set "URL=https://github.com/basir2353/pops-desktop-updates/releases/download/%TAG%/%EXE%"
set "OUT=%TEMP%\%EXE%"

echo.
echo [POPS] Downloading suite installer...
echo     %URL%
echo.

where curl >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%OUT%' -UseBasicParsing"
) else (
  curl -L --fail --retry 3 -o "%OUT%" "%URL%"
)
if errorlevel 1 (
  echo Download failed. Open this URL in the browser and run the setup:
  echo %URL%
  pause
  exit /b 1
)

echo.
echo [POPS] Installing in place. Close the app if it is open.
echo.
start /wait "" "%OUT%" /S
set "EC=%ERRORLEVEL%"
echo.
if "%EC%"=="0" (
  echo Done. Start the app — version should be 0.3.100+.
) else (
  echo Installer exit code %EC%. Try running manually: %OUT%
)
echo.
pause
exit /b %EC%
