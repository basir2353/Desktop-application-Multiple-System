@echo off
setlocal
REM Build POPS Staff APK (Waiter + Rider tabs, Email | PIN) with live Railway API.

set POPS_BUILD_ROOT=E:\pos-build
set NODE_ENV=production

echo Syncing waiter-mobile to E:\pos-build...
robocopy "%~dp0apps\waiter-mobile" "E:\pos-build\apps\waiter-mobile" /MIR /XD android dist .expo node_modules /NFL /NDL /NJH /NJS /nc /ns /np >nul

echo Building Staff APK from E:\pos-build...
cd /d E:\pos-build
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:staff-apk:win
if errorlevel 1 exit /b 1

echo.
echo Done: apps\waiter-mobile\dist\pops-staff-release.apk
echo Also under: E:\main pos\Desktop-application-Multiple-System\apps\waiter-mobile\dist\
echo Live API: https://backend-desktop-production-5505.up.railway.app
echo Waiter: waiter1@platform.local / PIN 1111 · Branch ISB-GT
echo Rider:  rider1@platform.local / PIN 6666 · Branch ISB-GT
endlocal
