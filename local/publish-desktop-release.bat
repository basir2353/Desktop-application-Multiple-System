@echo off
setlocal EnableExtensions
REM Publish signed desktop installers + latest-*.json to PUBLIC update repo.
REM Usage: local\publish-desktop-release.bat [version]
cd /d "%~dp0\.."

set "VER=%~1"
if "%VER%"=="" set "VER=0.3.10"
set "TAG=desktop-v%VER%"
set "DIR=%CD%\dist-installers\updates\desktop-v%VER%"
set "REPO=basir2353/pops-desktop-updates"

if not exist "%DIR%" (
  echo Missing release folder: %DIR%
  echo Build first with local\build-suite-and-restaurant.bat
  exit /b 1
)

where gh >nul 2>&1
if errorlevel 1 (
  echo GitHub CLI ^(gh^) not found. Install from https://cli.github.com/
  exit /b 1
)

echo Publishing %TAG% to %REPO% from %DIR%
gh release view "%TAG%" --repo "%REPO%" >nul 2>&1
if errorlevel 1 (
  gh release create "%TAG%" --repo "%REPO%" --latest --title "Desktop %VER% (auto-update)" --notes "Signed desktop installers with Tauri auto-update." "%DIR%\*"
) else (
  gh release upload "%TAG%" --repo "%REPO%" "%DIR%\*" --clobber
  gh release edit "%TAG%" --repo "%REPO%" --latest
)

REM Floating feed (no /latest redirect) — Tauri primary endpoint
if exist "%DIR%\latest-restaurant.json" (
  gh release view "desktop-updater-feed" --repo "%REPO%" >nul 2>&1
  if errorlevel 1 (
    gh release create "desktop-updater-feed" --repo "%REPO%" --title "Desktop updater feed" --notes "Mutable feed JSON for Tauri updater." "%DIR%\latest-restaurant.json" "%DIR%\latest-suite.json"
  ) else (
    gh release upload "desktop-updater-feed" --repo "%REPO%" "%DIR%\latest-restaurant.json" "%DIR%\latest-suite.json" --clobber
  )
)

REM Optional force-update bats if present in local\
if exist "%CD%\local\client-force-update-restaurant.bat" (
  gh release upload "%TAG%" --repo "%REPO%" "%CD%\local\client-force-update-restaurant.bat" "%CD%\local\client-force-update-suite.bat" --clobber
)

echo.
echo Live update feeds:
echo   https://github.com/basir2353/pops-desktop-updates/releases/download/desktop-updater-feed/latest-restaurant.json
echo   https://github.com/basir2353/pops-desktop-updates/releases/latest/download/latest-restaurant.json
exit /b 0
