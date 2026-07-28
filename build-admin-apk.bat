@echo off
setlocal
REM Build POPS Admin APK (dashboard, users, activity, PRA) with live Railway API.

set POPS_BUILD_ROOT=E:\pos-build
set NODE_ENV=production

echo Syncing waiter-mobile to E:\pos-build...
robocopy "%~dp0apps\waiter-mobile" "E:\pos-build\apps\waiter-mobile" /MIR /XD android dist .expo node_modules /NFL /NDL /NJH /NJS /nc /ns /np >nul

echo Building Admin APK from E:\pos-build...
cd /d E:\pos-build
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:admin-apk:win
if errorlevel 1 exit /b 1

echo.
echo Done: apps\waiter-mobile\dist\pops-admin-release.apk
echo Also under: E:\main pos\Desktop-application-Multiple-System\apps\waiter-mobile\dist\
echo Live API: https://backend-desktop-production-5505.up.railway.app
echo Admin login: manager1@platform.local / changeme-please-01
echo PRA on/off: Admin / Incharge (manager) only
endlocal
