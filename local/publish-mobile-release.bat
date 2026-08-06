@echo off
setlocal EnableExtensions
REM Publish admin + staff APKs + latest-*.json to PUBLIC mobile update repo.
REM Usage: local\publish-mobile-release.bat [version]
cd /d "%~dp0\.."

set "VER=%~1"
if "%VER%"=="" set "VER=1.1.10"
set "TAG=mobile-v%VER%"
set "DIR=%CD%\dist-installers\mobile-updates\%TAG%"
set "REPO=basir2353/pops-mobile-updates"

if not exist "%DIR%" (
  echo Missing release folder: %DIR%
  echo Build APKs first, then run write-mobile-update-manifest for admin and staff.
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
  gh release create "%TAG%" --repo "%REPO%" --title "Mobile %VER% (auto-update)" --notes "Admin + Staff APKs with auto-update feeds." "%DIR%\*"
) else (
  gh release upload "%TAG%" --repo "%REPO%" "%DIR%\*" --clobber
)

echo.
echo Live update feeds:
echo   https://github.com/basir2353/pops-mobile-updates/releases/latest/download/latest-admin.json
echo   https://github.com/basir2353/pops-mobile-updates/releases/latest/download/latest-staff.json
exit /b 0
