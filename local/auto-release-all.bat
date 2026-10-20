@echo off
setlocal EnableExtensions
REM Fast-track: bump versions, build EXEs + APKs, write manifests, optional publish (~15 min warm).
REM   local\auto-release-all.bat           — build only
REM   local\auto-release-all.bat publish   — build + GitHub publish
cd /d "%~dp0\.."
set "REPO=%CD%"
set "PUBLISH=%~1"
if /I "%~1"=="skip-bump" set "PUBLISH=%~2"
if /I "%~2"=="skip-bump" set "SKIP_BUMP=1"
if /I "%~1"=="skip-bump" set "SKIP_BUMP=1"
set "START=%TIME%"

echo.
echo ============================================
echo  POPS auto-release (EXEs + APKs + publish)
echo ============================================

call "%REPO%\local\set-build-live-api.bat"
if errorlevel 1 exit /b 1

echo.
if defined SKIP_BUMP (
  echo [1/7] Skip bump — using current package versions
) else (
  echo [1/7] Bump desktop + mobile versions...
  node "%REPO%\local\bump-release-versions.cjs"
  if errorlevel 1 exit /b 1
)
for /f "delims=" %%J in ('node -e "console.log(require('./apps/launcher/package.json').version)"') do set "DESKTOP_VER=%%J"
for /f "delims=" %%J in ('node -e "console.log(require('./apps/waiter-mobile/package.json').version)"') do set "MOBILE_VER=%%J"
echo   Desktop: v%DESKTOP_VER%  Mobile: v%MOBILE_VER%

echo.
echo [2/7] Build Universal + Restaurant EXE (signed, auto-update)...
call "%REPO%\local\build-suite-and-restaurant.bat"
if errorlevel 1 (
  echo EXE build failed.
  exit /b 1
)

echo.
echo [3/7] Build Admin APK...
call "%REPO%\local\build-fast.bat" admin-apk
if errorlevel 1 exit /b 1
cd /d "%REPO%\apps\waiter-mobile"
call pnpm exec node .\scripts\write-mobile-update-manifest.mjs admin
if errorlevel 1 exit /b 1

echo.
echo [4/7] Build Staff APK...
cd /d "%REPO%"
call "%REPO%\local\build-fast.bat" staff-apk
if errorlevel 1 exit /b 1
cd /d "%REPO%\apps\waiter-mobile"
call pnpm exec node .\scripts\write-mobile-update-manifest.mjs staff
if errorlevel 1 exit /b 1

echo.
echo [5/7] Build MobiZone APK...
cd /d "%REPO%"
call "%REPO%\local\set-build-live-api.bat"
set "POPS_FAST_BUILD=1"
REM Clear stale RN bundle dirs (avoids Hermes FileAlreadyExistsException)
set "BR=%~d0\pops"
if /I "%~d0"=="E:" if exist "E:\pos-build" set "BR=E:\pos-build"
if exist "%BR%\apps\waiter-mobile\android\app\build\generated\assets\createBundleReleaseJsAndAssets" (
  rmdir /s /q "%BR%\apps\waiter-mobile\android\app\build\generated\assets\createBundleReleaseJsAndAssets" 2>nul
)
if exist "%BR%\apps\waiter-mobile\android\app\build\intermediates\assets\release" (
  rmdir /s /q "%BR%\apps\waiter-mobile\android\app\build\intermediates\assets\release" 2>nul
)
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:mobizone-apk:win
if errorlevel 1 (
  echo MobiZone APK build failed.
  exit /b 1
)
cd /d "%REPO%\apps\waiter-mobile"
call pnpm exec node .\scripts\write-mobile-update-manifest.mjs mobizone
if errorlevel 1 exit /b 1

cd /d "%REPO%"
echo.
echo [6/7] Release artifacts ready:
echo   dist-installers\updates\latest-suite.json
echo   dist-installers\updates\latest-restaurant.json
echo   dist-installers\mobile-updates\latest-admin.json
echo   dist-installers\mobile-updates\latest-staff.json
echo   dist-installers\mobile-updates\latest-mobizone.json

if /I "%PUBLISH%"=="publish" (
  echo.
  echo [7/7] Publishing to GitHub Releases...
  call "%REPO%\local\publish-all-releases.bat" %DESKTOP_VER% %MOBILE_VER%
  if errorlevel 1 exit /b 1
) else (
  echo.
  echo [7/7] Skipped publish. To upload:
  echo   local\publish-all-releases.bat %DESKTOP_VER% %MOBILE_VER%
)

echo.
echo ============================================
echo  AUTO-RELEASE DONE
echo  Desktop v%DESKTOP_VER%  Mobile v%MOBILE_VER%
echo  Live API: %VITE_API_BASE_URL%
echo  Started: %START%  Finished: %TIME%
echo ============================================
exit /b 0
