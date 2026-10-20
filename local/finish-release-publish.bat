@echo off
setlocal EnableExtensions
REM Continue release: rebuild APKs from real repo path (no D:\pops Metro SHA-1), then publish.
cd /d "%~dp0\.."
set "REPO=%CD%"
call "%REPO%\local\set-build-live-api.bat"
if errorlevel 1 exit /b 1

set "POPS_SKIP_SHORT_PATH=1"
set "POPS_FAST_BUILD=1"
set "POPS_GRADLE_DAEMON=0"
set "GRADLE_USER_HOME=E:\pos-build\gradle-home"
if not exist "E:\pos-build" set "GRADLE_USER_HOME=C:\pops\gradle-home"
if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"
if exist "C:\Android\Sdk\SDK\platform-tools" (
  set "ANDROID_HOME=C:\Android\Sdk\SDK"
) else if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools" (
  set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"

for /f "delims=" %%J in ('node -e "console.log(require('./apps/launcher/package.json').version)"') do set "DESKTOP_VER=%%J"
for /f "delims=" %%J in ('node -e "console.log(require('./apps/waiter-mobile/package.json').version)"') do set "MOBILE_VER=%%J"
echo Desktop v%DESKTOP_VER%  Mobile v%MOBILE_VER%
echo Building APKs from %REPO% (POPS_SKIP_SHORT_PATH=1)...

echo.
echo === 1/3 ADMIN APK ===
cd /d "%REPO%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:admin-apk:win
if errorlevel 1 exit /b 1
cd /d "%REPO%\apps\waiter-mobile"
call pnpm exec node .\scripts\write-mobile-update-manifest.mjs admin
if errorlevel 1 exit /b 1

echo.
echo === 2/3 STAFF APK ===
cd /d "%REPO%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:staff-apk:win
if errorlevel 1 exit /b 1
cd /d "%REPO%\apps\waiter-mobile"
call pnpm exec node .\scripts\write-mobile-update-manifest.mjs staff
if errorlevel 1 exit /b 1

echo.
echo === 3/3 MOBIZONE APK ===
cd /d "%REPO%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:mobizone-apk:win
if errorlevel 1 exit /b 1
cd /d "%REPO%\apps\waiter-mobile"
call pnpm exec node .\scripts\write-mobile-update-manifest.mjs mobizone
if errorlevel 1 exit /b 1

cd /d "%REPO%"
echo.
echo === PUBLISH desktop + mobile ===
call "%REPO%\local\publish-all-releases.bat" %DESKTOP_VER% %MOBILE_VER%
if errorlevel 1 exit /b 1

echo.
echo FINISH_RELEASE_DONE Desktop=%DESKTOP_VER% Mobile=%MOBILE_VER%
exit /b 0
