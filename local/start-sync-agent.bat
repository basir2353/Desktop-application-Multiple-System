@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."
echo ============================================
echo  Super Admin data sync agent
echo  Status: http://127.0.0.1:1421/status
echo  Health page: /super-admin/health
echo ============================================
echo.
if not exist "local\.env.sync.local" (
  echo [ERROR] Missing local\.env.sync.local
  echo Copy credentials for OLD_DATABASE_URL and NEW_DATABASE_URL.
  pause
  exit /b 1
)
node local\sync-old-to-new.mjs
pause
