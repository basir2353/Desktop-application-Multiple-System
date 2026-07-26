@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

echo ============================================
echo  POPS Local API  -  for desktop EXE
echo  URL: http://127.0.0.1:3000
echo ============================================
echo.

REM Prefer local\.env for this machine
if exist "local\.env" (
  copy /Y "local\.env" ".env" >nul
  echo [OK] Copied local\.env -^> .env
) else (
  echo [WARN] local\.env missing — using existing root .env
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker not found. Install Docker Desktop, then retry.
  pause
  exit /b 1
)

echo.
echo [1/3] Starting Postgres (docker compose)...
docker compose up -d
if errorlevel 1 (
  echo [ERROR] docker compose failed.
  pause
  exit /b 1
)

echo.
echo [2/3] Waiting for Postgres...
timeout /t 5 /nobreak >nul

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

echo.
echo [3/3] Schema push + starting API on :3000 ...
call %PNPM% db:push
if errorlevel 1 (
  echo [WARN] db:push failed — API may still start if schema already exists.
)

echo.
echo API starting... Keep this window OPEN.
echo In the EXE login screen: select  Local API
echo Then sign in (see local\README.md for passwords).
echo.
call %PNPM% dev:api

pause
