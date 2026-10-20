@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
set "REPO=%CD%"

REM Avoid hermes FileAlreadyExistsException from interrupted builds
call :CLEAR_BUNDLE_STALE

echo === 1/3 ADMIN APK ===
call "%REPO%\local\build-fast.bat" admin-apk
if errorlevel 1 exit /b 1

call :CLEAR_BUNDLE_STALE
echo === 2/3 STAFF APK ===
call "%REPO%\local\build-fast.bat" staff-apk
if errorlevel 1 exit /b 1

call :CLEAR_BUNDLE_STALE
echo === 3/3 MOBIZONE APK ===
call "%REPO%\local\set-build-live-api.bat"
set "POPS_FAST_BUILD=1"
set "POPS_GRADLE_DAEMON=0"
set "GRADLE_USER_HOME=E:\pos-build\gradle-home"
if not exist "E:\pos-build" set "GRADLE_USER_HOME=C:\pops\gradle-home"
if not exist "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"
set "POPS_BUILD_ROOT=%~d0\pops"
if /I "%~d0"=="E:" if exist "E:\pos-build" set "POPS_BUILD_ROOT=E:\pos-build"
if not exist "%POPS_BUILD_ROOT%\apps" mkdir "%POPS_BUILD_ROOT%\apps"
robocopy "%REPO%\apps\waiter-mobile" "%POPS_BUILD_ROOT%\apps\waiter-mobile" /MIR /XD android dist .expo node_modules android.stale* /NFL /NDL /NJH /NJS /nc /ns /np >nul
if not exist "%POPS_BUILD_ROOT%\node_modules" mklink /J "%POPS_BUILD_ROOT%\node_modules" "%REPO%\node_modules" >nul 2>&1
if not exist "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules\expo\package.json" (
  if exist "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" rmdir /s /q "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" 2>nul
  mklink /J "%POPS_BUILD_ROOT%\apps\waiter-mobile\node_modules" "%REPO%\apps\waiter-mobile\node_modules" >nul 2>&1
)
if not exist "%POPS_BUILD_ROOT%\package.json" copy /Y "%REPO%\package.json" "%POPS_BUILD_ROOT%\package.json" >nul
if not exist "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" copy /Y "%REPO%\pnpm-workspace.yaml" "%POPS_BUILD_ROOT%\pnpm-workspace.yaml" >nul
cd /d "%POPS_BUILD_ROOT%"
call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:mobizone-apk:win
if errorlevel 1 (
  cd /d "%REPO%"
  call "%APPDATA%\npm\pnpm.cmd" --filter @platform/waiter-mobile build:mobizone-apk:win
  if errorlevel 1 exit /b 1
)
mkdir "%REPO%\apps\waiter-mobile\dist" 2>nul
if exist "%POPS_BUILD_ROOT%\apps\waiter-mobile\dist\mobizone-erp-release.apk" (
  copy /Y "%POPS_BUILD_ROOT%\apps\waiter-mobile\dist\mobizone-erp-release.apk" "%REPO%\apps\waiter-mobile\dist\mobizone-erp-release.apk" >nul
)
echo Done: %REPO%\apps\waiter-mobile\dist\mobizone-erp-release.apk
echo === ALL APKS OK ===
exit /b 0

:CLEAR_BUNDLE_STALE
set "BR=%~d0\pops"
if /I "%~d0"=="E:" if exist "E:\pos-build" set "BR=E:\pos-build"
if exist "%BR%\apps\waiter-mobile\android\app\build\generated\assets\createBundleReleaseJsAndAssets" (
  rmdir /s /q "%BR%\apps\waiter-mobile\android\app\build\generated\assets\createBundleReleaseJsAndAssets" 2>nul
)
if exist "%BR%\apps\waiter-mobile\android\app\build\intermediates\assets\release" (
  rmdir /s /q "%BR%\apps\waiter-mobile\android\app\build\intermediates\assets\release" 2>nul
)
if exist "%BR%\apps\waiter-mobile\android\app\build\intermediates\compressed_assets\release" (
  rmdir /s /q "%BR%\apps\waiter-mobile\android\app\build\intermediates\compressed_assets\release" 2>nul
)
if exist "%BR%\apps\waiter-mobile\android\app\build\intermediates\sourcemaps\react\release" (
  rmdir /s /q "%BR%\apps\waiter-mobile\android\app\build\intermediates\sourcemaps\react\release" 2>nul
)
goto :eof
