@echo off
setlocal
REM Prefer short path for Windows CMake MAX_PATH.
set POPS_BUILD_ROOT=C:\pops
if exist E:\pos-build set POPS_BUILD_ROOT=E:\pos-build
set POPS_FAST_BUILD=1
set POPS_GRADLE_DAEMON=1
set NODE_ENV=production

REM Resolve Android SDK (do not force a missing LocalAppData path).
if defined ANDROID_HOME if exist "%ANDROID_HOME%\platforms" goto sdk_ok
if exist "%LOCALAPPDATA%\Android\Sdk\platforms" set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
if exist "C:\Android\Sdk\SDK\platforms" set ANDROID_HOME=C:\Android\Sdk\SDK
if exist "C:\Android\Sdk\Sdk\platforms" set ANDROID_HOME=C:\Android\Sdk\Sdk
if exist "C:\Android\Sdk\platforms" set ANDROID_HOME=C:\Android\Sdk
:sdk_ok
set ANDROID_SDK_ROOT=%ANDROID_HOME%
if not exist "%ANDROID_HOME%\platforms" (
  echo ERROR: Android SDK not found. Set ANDROID_HOME to a folder that contains platforms\.
  exit /b 1
)
echo Using ANDROID_HOME=%ANDROID_HOME%

echo Syncing waiter-mobile to %POPS_BUILD_ROOT%...
if not exist "%POPS_BUILD_ROOT%\apps" mkdir "%POPS_BUILD_ROOT%\apps"
robocopy "%~dp0apps\waiter-mobile" "%POPS_BUILD_ROOT%\apps\waiter-mobile" /MIR /XD android dist .expo node_modules /NFL /NDL /NJH /NJS /nc /ns /np >nul

if not exist "%POPS_BUILD_ROOT%\node_modules" mklink /J "%POPS_BUILD_ROOT%\node_modules" "%~dp0node_modules"
if not exist "%POPS_BUILD_ROOT%\package.json" copy /Y "%~dp0package.json" "%POPS_BUILD_ROOT%\package.json" >nul
if not exist "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" copy /Y "%~dp0pnpm-workspace.yaml" "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" >nul

REM Ensure Gradle can find the SDK even if env is lost mid-build.
> "%POPS_BUILD_ROOT%\apps\waiter-mobile\android\local.properties" echo sdk.dir=%ANDROID_HOME:\=/%
if exist "%~dp0apps\waiter-mobile\android" > "%~dp0apps\waiter-mobile\android\local.properties" echo sdk.dir=%ANDROID_HOME:\=/%

echo Building Staff APK from %POPS_BUILD_ROOT%...
cd /d "%POPS_BUILD_ROOT%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:staff-apk:win
if errorlevel 1 (
  echo Short-path build failed — retrying from repo...
  cd /d "%~dp0"
  call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:staff-apk:win
  if errorlevel 1 exit /b 1
)

echo.
echo Done: apps\waiter-mobile\dist\pops-staff-release.apk
echo Live API: https://backend-desktop-production-600b.up.railway.app
endlocal
