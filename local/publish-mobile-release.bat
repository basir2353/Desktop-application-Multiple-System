@echo off
setlocal EnableExtensions
REM Publish admin + staff + mobizone APKs + latest-*.json to PUBLIC mobile update repo.
REM Usage: local\publish-mobile-release.bat [version]
cd /d "%~dp0\.."

set "VER=%~1"
if "%VER%"=="" set "VER=1.1.10"
set "TAG=mobile-v%VER%"
set "DIR=%CD%\dist-installers\mobile-updates\%TAG%"
set "REPO=basir2353/pops-mobile-updates"
set "FEED_REPO=basir2353/pops-desktop-updates"

if not exist "%DIR%" (
  echo Missing release folder: %DIR%
  echo Build APKs first, then run write-mobile-update-manifest for admin/staff/mobizone.
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
  gh release create "%TAG%" --repo "%REPO%" --title "Mobile %VER% (auto-update)" --notes "Admin + Staff + MobiZone APKs with auto-update feeds." "%DIR%\*"
) else (
  gh release upload "%TAG%" --repo "%REPO%" "%DIR%\*" --clobber
)

REM Floating feeds apps actually poll (same host as desktop updater)
if exist "%CD%\dist-installers\mobile-updates\latest-admin.json" (
  gh release upload "desktop-updater-feed" --repo "%FEED_REPO%" "%CD%\dist-installers\mobile-updates\latest-admin.json" --clobber
)
if exist "%CD%\dist-installers\mobile-updates\latest-staff.json" (
  gh release upload "desktop-updater-feed" --repo "%FEED_REPO%" "%CD%\dist-installers\mobile-updates\latest-staff.json" --clobber
)
if exist "%CD%\dist-installers\mobile-updates\latest-mobizone.json" (
  gh release upload "desktop-updater-feed" --repo "%FEED_REPO%" "%CD%\dist-installers\mobile-updates\latest-mobizone.json" --clobber
)

echo.
echo Live update feeds:
echo   https://github.com/basir2353/pops-desktop-updates/releases/download/desktop-updater-feed/latest-admin.json
echo   https://github.com/basir2353/pops-desktop-updates/releases/download/desktop-updater-feed/latest-staff.json
echo   https://github.com/basir2353/pops-desktop-updates/releases/download/desktop-updater-feed/latest-mobizone.json
exit /b 0
