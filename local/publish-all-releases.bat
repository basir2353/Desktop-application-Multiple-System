@echo off
setlocal EnableExtensions
REM Publish desktop + mobile auto-update feeds to GitHub.
REM Usage: local\publish-all-releases.bat [desktopVersion] [mobileVersion]
cd /d "%~dp0\.."

set "DESKTOP_VER=%~1"
set "MOBILE_VER=%~2"
if "%DESKTOP_VER%"=="" (
  for /f "delims=" %%J in ('node -e "console.log(require('./apps/launcher/package.json').version)"') do set "DESKTOP_VER=%%J"
)
if "%MOBILE_VER%"=="" (
  for /f "delims=" %%J in ('node -e "console.log(require('./apps/waiter-mobile/package.json').version)"') do set "MOBILE_VER=%%J"
)

echo Publishing desktop v%DESKTOP_VER% + mobile v%MOBILE_VER%...

call "%~dp0publish-desktop-release.bat" %DESKTOP_VER%
if errorlevel 1 exit /b 1

call "%~dp0publish-mobile-release.bat" %MOBILE_VER%
if errorlevel 1 exit /b 1

echo.
echo All auto-update feeds live:
echo   Desktop suite:     https://github.com/basir2353/pops-desktop-updates/releases/latest/download/latest-suite.json
echo   Desktop restaurant: https://github.com/basir2353/pops-desktop-updates/releases/latest/download/latest-restaurant.json
echo   Mobile admin:      https://github.com/basir2353/pops-mobile-updates/releases/latest/download/latest-admin.json
echo   Mobile staff:      https://github.com/basir2353/pops-mobile-updates/releases/latest/download/latest-staff.json
exit /b 0
