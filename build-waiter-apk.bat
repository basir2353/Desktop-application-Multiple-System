@echo off
setlocal
REM Legacy single-role Waiter APK. Prefer build-staff-apk.bat (Waiter + Rider in one app).

set POPS_BUILD_ROOT=E:\pos-build
set NODE_ENV=production

echo Syncing waiter-mobile to E:\pos-build...
robocopy "%~dp0apps\waiter-mobile" "E:\pos-build\apps\waiter-mobile" /MIR /XD android dist .expo node_modules /NFL /NDL /NJH /NJS /nc /ns /np >nul

echo Building waiter APK from E:\pos-build...
cd /d E:\pos-build
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:waiter-apk:win
if errorlevel 1 exit /b 1

echo.
echo Done: apps\waiter-mobile\dist\pops-waiter-release.apk
echo Tip: use build-staff-apk.bat for Waiter + Rider combined APK.
endlocal
