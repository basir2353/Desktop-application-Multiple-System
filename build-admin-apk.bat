@echo off
setlocal
REM Build POPS Admin APK (dashboard, sales, users, activity, PRA) with live Railway API.

REM Prefer short path for Windows CMake MAX_PATH. Fall back if E: is missing.
set POPS_BUILD_ROOT=C:\pops
if exist E:\pos-build set POPS_BUILD_ROOT=E:\pos-build
set POPS_FAST_BUILD=1
set POPS_GRADLE_DAEMON=1
set NODE_ENV=production
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set ANDROID_SDK_ROOT=%ANDROID_HOME%

echo Syncing waiter-mobile to %POPS_BUILD_ROOT%...
if not exist "%POPS_BUILD_ROOT%\apps" mkdir "%POPS_BUILD_ROOT%\apps"
robocopy "%~dp0apps\waiter-mobile" "%POPS_BUILD_ROOT%\apps\waiter-mobile" /MIR /XD android dist .expo node_modules /NFL /NDL /NJH /NJS /nc /ns /np >nul

REM Link monorepo node_modules into short path so Gradle/pnpm resolve packages.
if not exist "%POPS_BUILD_ROOT%\node_modules" mklink /J "%POPS_BUILD_ROOT%\node_modules" "%~dp0node_modules"
if not exist "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" mklink /J "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" "%~dp0apps\waiter-mobile\node_modules"
if not exist "%POPS_BUILD_ROOT%\package.json" copy /Y "%~dp0package.json" "%POPS_BUILD_ROOT%\package.json" >nul
if not exist "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" copy /Y "%~dp0pnpm-workspace.yaml" "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" >nul

echo Building Admin APK from %POPS_BUILD_ROOT%...
cd /d "%POPS_BUILD_ROOT%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:admin-apk:win
if errorlevel 1 (
  echo Short-path build failed — retrying from repo...
  cd /d "%~dp0"
  call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:admin-apk:win
  if errorlevel 1 exit /b 1
)

echo.
echo Done: apps\waiter-mobile\dist\pops-admin-release.apk
echo Live API: https://backend-desktop-production-5505.up.railway.app
echo Admin login: admin.restaurant@pops.demo / Owner@12345
echo PRA on/off: Admin / Incharge (manager) only
endlocal
