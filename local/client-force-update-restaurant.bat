@echo off
setlocal EnableExtensions
REM =============================================================================
REM IN-PLACE UPDATE (same EXE / same folder) — does NOT install a second app.
REM Downloads the signed installer from pops-desktop-updates and runs it.
REM =============================================================================

set "TAG=desktop-v0.3.104"
set "EXE=Restaurant-Management-System_0.3.104_x64-setup.exe"
set "URL=https://github.com/basir2353/pops-desktop-updates/releases/download/%TAG%/%EXE%"
set "OUT=%TEMP%\%EXE%"

echo.
echo ============================================================
echo  POPS — Update EXISTING Restaurant EXE (same folder)
echo  Nayi alag app add nahi hogi. Purani install overwrite hogi.
echo ============================================================
echo.
echo [1/4] Closing Restaurant Management System if it is open...
taskkill /IM "Restaurant Management System.exe" /F >nul 2>&1
taskkill /IM "restaurant-management-system.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Downloading update package...
echo      %URL%
echo.

where curl >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%OUT%' -UseBasicParsing"
) else (
  curl.exe -L --fail --retry 5 --retry-delay 2 -o "%OUT%" "%URL%"
)
if errorlevel 1 (
  echo DOWNLOAD FAILED.
  echo Browser se ye file download karke double-click karo:
  echo %URL%
  start "" "%URL%"
  pause
  exit /b 1
)

if not exist "%OUT%" (
  echo DOWNLOAD FAILED — file missing: %OUT%
  start "" "%URL%"
  pause
  exit /b 1
)

echo [3/4] Opening installer (Finish dabao — same folder update)...
echo.
start /wait "" "%OUT%"
set "EC=%ERRORLEVEL%"

echo [4/4] Done.
echo.
if "%EC%"=="0" (
  echo OK — Restaurant EXE updated to 0.3.104 in the SAME place.
  echo Ab shortcut se "Restaurant Management System" kholo.
  echo Agar purana "Update failed" banner dikhe to Dismiss dabao — ignore karo.
) else (
  echo Installer band ho gaya ^(exit %EC%^). Agar update nahi hua to:
  echo   1^) Is file ko double-click karke Finish karo:
  echo      %OUT%
  echo   2^) Ya browser se download:
  echo      %URL%
)
echo.
pause
exit /b %EC%
