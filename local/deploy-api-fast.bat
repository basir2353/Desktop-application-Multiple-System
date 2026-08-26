@echo off
setlocal
cd /d "%~dp0..\backend-desktop"

echo.
echo === Fast Railway API deploy ===
echo Root: backend-desktop  ^|  Docker cache + skip slow boot steps
echo.

where railway >nul 2>&1
if errorlevel 1 (
  echo Railway CLI not found. Install: npm i -g @railway/cli
  exit /b 1
)

echo Checking Railway link...
railway status >nul 2>&1
if errorlevel 1 (
  echo Not linked. Run: cd backend-desktop ^&^& railway link
  exit /b 1
)

echo Deploying ^(watch build in Railway dashboard^)...
railway up --detach
if errorlevel 1 (
  echo Deploy failed.
  exit /b 1
)

echo.
echo Deploy queued. Typical warm build: 3-8 min ^| cold: 10-15 min
echo Health: https://backend-desktop-production-600b.up.railway.app/health
echo.
echo After schema/index changes only, set Railway variable once:
echo   RAILWAY_RUN_ENSURE_SCHEMA=1  ^(then redeploy, then set back to 0^)
echo.
endlocal
