@echo off
setlocal EnableExtensions
REM =============================================================================
REM Fast release builds (target ~5 min when caches are warm)
REM
REM Usage:
REM   local\build-fast.bat exe
REM   local\build-fast.bat admin-apk
REM   local\build-fast.bat staff-apk
REM   local\build-fast.bat waiter-apk
REM   local\build-fast.bat rider-apk
REM   local\build-fast.bat warm          (one-time: prime EXE + admin android caches)
REM
REM Rules for speed:
REM   - Never wipe Cargo / Gradle / android/ caches
REM   - Prefer C:\pops short path for APKs
REM   - Set POPS_FAST_BUILD=1 (skip prebuild wipe, Gradle daemon on)
REM =============================================================================

cd /d "%~dp0\.."
set "REPO=%CD%"
set "POPS_FAST_BUILD=1"
set "POPS_GRADLE_DAEMON=1"
set "NODE_ENV=production"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

set "TARGET=%~1"
if "%TARGET%"=="" (
  echo.
  echo Usage: local\build-fast.bat [exe^|admin-apk^|staff-apk^|waiter-apk^|rider-apk^|warm]
  echo.
  exit /b 1
)

if /I "%TARGET%"=="exe" goto BUILD_EXE
if /I "%TARGET%"=="admin-apk" goto BUILD_APK_ADMIN
if /I "%TARGET%"=="staff-apk" goto BUILD_APK_STAFF
if /I "%TARGET%"=="waiter-apk" goto BUILD_APK_WAITER
if /I "%TARGET%"=="rider-apk" goto BUILD_APK_RIDER
if /I "%TARGET%"=="warm" goto WARM
echo Unknown target: %TARGET%
exit /b 1

:BUILD_EXE
echo.
echo === FAST EXE (Cargo cache kept) ===
call "%REPO%\local\build-exe-fast.bat"
exit /b %ERRORLEVEL%

:PREP_APK_ROOT
REM Same drive as repo (cross-drive junctions break Metro/Gradle path relativization).
set "POPS_BUILD_ROOT=%~d0\pops"
if /I "%~d0"=="E:" if exist "E:\pos-build" set "POPS_BUILD_ROOT=E:\pos-build"
if not exist "%POPS_BUILD_ROOT%\apps" mkdir "%POPS_BUILD_ROOT%\apps"
echo Syncing waiter-mobile JS → %POPS_BUILD_ROOT% (android/ kept)...
robocopy "%REPO%\apps\waiter-mobile" "%POPS_BUILD_ROOT%\apps\waiter-mobile" /MIR /XD android dist .expo node_modules android.stale* /NFL /NDL /NJH /NJS /nc /ns /np >nul
if not exist "%POPS_BUILD_ROOT%\node_modules" mklink /J "%POPS_BUILD_ROOT%\node_modules" "%REPO%\node_modules" >nul 2>&1
REM App-local node_modules (expo lives here under pnpm). Replace empty dir with junction.
if exist "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules\expo\package.json" goto NM_OK
if exist "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" rmdir /s /q "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" 2>nul
mklink /J "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" "%REPO%\apps\waiter-mobile\node_modules" >nul 2>&1
:NM_OK
if not exist "%POPS_BUILD_ROOT%\package.json" copy /Y "%REPO%\package.json" "%POPS_BUILD_ROOT%\package.json" >nul
if not exist "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" copy /Y "%REPO%\pnpm-workspace.yaml" "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" >nul
REM Short native paths (Windows MAX_PATH)
if not exist "C:\rn\package.json" (
  if exist "%REPO%\node_modules\react-native\package.json" mklink /J "C:\rn" "%REPO%\node_modules\react-native" >nul 2>&1
)
if not exist "C:\emc\package.json" (
  if exist "%REPO%\node_modules\expo-modules-core\package.json" mklink /J "C:\emc" "%REPO%\node_modules\expo-modules-core" >nul 2>&1
)
goto :eof

:BUILD_APK_ADMIN
call :PREP_APK_ROOT
echo.
echo === FAST ADMIN APK ===
cd /d "%POPS_BUILD_ROOT%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:admin-apk:win
if errorlevel 1 (
  cd /d "%REPO%"
  call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:admin-apk:win
  if errorlevel 1 exit /b 1
)
echo Done: %REPO%\apps\waiter-mobile\dist\pops-admin-release.apk
exit /b 0

:BUILD_APK_STAFF
call :PREP_APK_ROOT
echo.
echo === FAST STAFF APK ===
cd /d "%POPS_BUILD_ROOT%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:staff-apk:win
if errorlevel 1 (
  cd /d "%REPO%"
  call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:staff-apk:win
  if errorlevel 1 exit /b 1
)
echo Done: %REPO%\apps\waiter-mobile\dist\pops-staff-release.apk
exit /b 0

:BUILD_APK_WAITER
call :PREP_APK_ROOT
echo.
echo === FAST WAITER APK ===
cd /d "%POPS_BUILD_ROOT%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile exec node ./scripts/build-apk.mjs waiter
if errorlevel 1 exit /b 1
echo Done: pops-waiter-release.apk
exit /b 0

:BUILD_APK_RIDER
call :PREP_APK_ROOT
echo.
echo === FAST RIDER APK ===
cd /d "%POPS_BUILD_ROOT%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile exec node ./scripts/build-apk.mjs rider
if errorlevel 1 exit /b 1
echo Done: pops-rider-release.apk
exit /b 0

:WARM
echo.
echo === WARM CACHES (run once after reboot / clean machine) ===
echo [1/2] Warming Cargo + Tauri EXE...
call "%REPO%\local\build-exe-fast.bat"
if errorlevel 1 echo EXE warm failed — continue APK warm anyway
echo [2/2] Warming Admin APK android/ + Gradle...
call :PREP_APK_ROOT
cd /d "%POPS_BUILD_ROOT%"
set "POPS_FAST_BUILD=1"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:admin-apk:win
echo.
echo Warm done. Later builds should be much faster.
exit /b 0
