@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ============================================
echo  POPS Web (browser)
echo  URL: http://127.0.0.1:1420/
echo ============================================
echo.
echo Keep this window OPEN while using the browser.
echo Optional sync agent (2nd window):
echo   node local\sync-old-to-new.mjs
echo.

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] pnpm not found. Run: npm install -g pnpm
    pause
    exit /b 1
  )
  set "PNPM=corepack pnpm"
) else (
  set "PNPM=pnpm"
)

call %PNPM% dev:web
pause
