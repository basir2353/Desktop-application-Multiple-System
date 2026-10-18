@echo off
setlocal EnableExtensions
REM =============================================================================
REM IN-PLACE UPDATE (same EXE / same folder) — does NOT install a second app.
REM
REM Why: Auto-update fails at ~99% with "different key" because the signing key
REM was rotated and the OLD private key is lost. The Update button downloads the
REM same installer, then rejects it. Running this applies that same installer
REM into the EXISTING "Restaurant Management System" install path.
REM =============================================================================

set "TAG=desktop-v0.3.100"
set "EXE=Restaurant-Management-System_0.3.100_x64-setup.exe"
set "URL=https://github.com/basir2353/pops-desktop-updates/releases/download/%TAG%/%EXE%"
set "OUT=%TEMP%\%EXE%"

echo.
echo ============================================================
echo  POPS — Update EXISTING Restaurant EXE (same PC / same folder)
echo  Nayi alag app add nahi hogi. Purani install overwrite hogi.
echo ============================================================
echo.
echo [1/3] Close Restaurant Management System if it is open.
echo [2/3] Downloading update package...
echo      %URL%
echo.

where curl >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%OUT%' -UseBasicParsing"
) else (
  curl.exe -L --fail --retry 3 -o "%OUT%" "%URL%"
)
if errorlevel 1 (
  echo DOWNLOAD FAILED.
  echo Browser se ye file download karke double-click karo ^(same in-place update^):
  echo %URL%
  pause
  exit /b 1
)

echo [3/3] Installing into the existing app folder...
echo.
REM /S = silent upgrade of current-user install (same product / same shortcuts)
start /wait "" "%OUT%" /S
set "EC=%ERRORLEVEL%"
echo.
if "%EC%"=="0" (
  echo OK — existing EXE updated to 0.3.100 in the same place.
  echo Start "Restaurant Management System" from the usual shortcut.
  echo Is ke baad app ke andar auto-update dubara chalega.
) else (
  echo Silent install exit %EC%. Manual: double-click this file and Finish:
  echo   %OUT%
  echo Yeh bhi SAME existing install update karega — dusri copy nahi banegi.
)
echo.
pause
exit /b %EC%
