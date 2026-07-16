@echo off
setlocal
REM Build POPS Rider APK with live Railway API (Windows).
REM Requires E:\pos-build monorepo copy (short path, no spaces).

set POPS_BUILD_ROOT=E:\pos-build
set NODE_ENV=production

echo Syncing waiter-mobile to E:\pos-build...
robocopy "%~dp0apps\waiter-mobile" "E:\pos-build\apps\waiter-mobile" /MIR /XD android dist .expo node_modules /NFL /NDL /NJH /NJS /nc /ns /np >nul

echo Building rider APK from E:\pos-build...
cd /d E:\pos-build
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:rider-apk:win
if errorlevel 1 exit /b 1

echo.
echo Done: apps\waiter-mobile\dist\pops-rider-release.apk
echo Live API: https://backend-desktop-production-5505.up.railway.app
echo Rider login: rider1@platform.local / changeme-please-01
endlocal
